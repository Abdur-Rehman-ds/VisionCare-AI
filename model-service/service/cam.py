"""Eigen-CAM attention maps (FR-4.5, amended per §21C).

Grad-CAM needs gradients; ONNX inference has none. Eigen-CAM
(Muhammad & Yeasin, 2020) projects the last conv feature maps onto
their first principal component — gradient-free, forward-only, and
faithful to "where did the model look". At startup we graph-surgery
the production ONNX to also expose the tensor feeding the global
pooling node; no second model file, no torch.
"""
from pathlib import Path

import cv2
import numpy as np
import onnx


def build_cam_model(src: Path, dst: Path) -> str:
    """Add the pre-pooling feature map as an extra graph output.
    Returns the tensor name to fetch.
    """
    m = onnx.load(str(src))
    pool_nodes = [
        n for n in m.graph.node
        if n.op_type in ("GlobalAveragePool", "ReduceMean", "AveragePool")
    ]
    if not pool_nodes:
        raise RuntimeError("no pooling node found for CAM")

    feat_name = pool_nodes[-1].input[0]
    vi = onnx.helper.make_tensor_value_info(
        feat_name,
        onnx.TensorProto.FLOAT,
        None,
    )
    m.graph.output.append(vi)
    onnx.save(m, str(dst))
    return feat_name


def eigen_cam(features: np.ndarray) -> np.ndarray:
    """(1, C, H, W) float32 -> (H, W) float in [0, 1]."""
    f = features[0]  # C, H, W
    c, h, w = f.shape
    m = f.reshape(c, h * w).T  # HW x C
    m = m - m.mean(axis=0, keepdims=True)
    _, _, vt = np.linalg.svd(m, full_matrices=False)
    cam = m @ vt[0]  # HW
    if cam.max() < -cam.min():
        cam = -cam  # flip sign so dominant response is positive
    cam = np.maximum(cam, 0).reshape(h, w)
    if cam.max() > 0:
        cam = cam / cam.max()
    return cam.astype(np.float32)


def _fundus_mask(img300_rgb: np.ndarray) -> np.ndarray:
    """Build a soft mask for the visible retinal region on the 300px image."""
    gray = cv2.cvtColor(img300_rgb, cv2.COLOR_RGB2GRAY)

    # Same basic threshold logic as preprocess.py
    mask = (gray > 10).astype(np.uint8) * 255

    if mask.sum() == 0:
        return np.zeros(gray.shape, dtype=np.float32)

    # Clean small holes first.
    close_kernel = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE, (7, 7)
    )
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, close_kernel)

    # Pull the visualization mask slightly inward so Eigen-CAM
    # activation on crop/padding boundaries is not shown as retinal
    # attention. This affects visualization only, never inference.
    erode_kernel = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE, (11, 11)
    )
    mask = cv2.erode(mask, erode_kernel, iterations=1)

    # Feather the new boundary for a natural overlay.
    mask = cv2.GaussianBlur(mask, (0, 0), 2.0)

    return np.clip(mask.astype(np.float32) / 255.0, 0.0, 1.0)


def overlay(cam: np.ndarray, img300_rgb: np.ndarray) -> bytes:
    """Blend the heatmap over the preprocessed 300px image -> PNG.

    Important:
    - suppress heat outside the retinal region
    - renormalize inside the retinal mask only
    """
    h, w = img300_rgb.shape[:2]

    heat = cv2.resize(
        cam.astype(np.float32),
        (w, h),
        interpolation=cv2.INTER_LINEAR,
    )

    mask = _fundus_mask(img300_rgb)
    inside = mask > 0.05

    # Remove outside-retina activation
    heat = np.maximum(heat, 0)
    heat[~inside] = 0

    # Renormalize only inside the retina so the color scale is meaningful
    if np.any(inside):
        vals = heat[inside]
        lo = float(vals.min())
        hi = float(vals.max())
        if hi > lo:
            heat[inside] = (heat[inside] - lo) / (hi - lo)
        else:
            heat[inside] = 0

    heat_u8 = (np.clip(heat, 0, 1) * 255).astype(np.uint8)
    heat_color = cv2.applyColorMap(heat_u8, cv2.COLORMAP_JET)

    base_bgr = cv2.cvtColor(img300_rgb, cv2.COLOR_RGB2BGR)
    mixed = cv2.addWeighted(base_bgr, 0.60, heat_color, 0.40, 0)

    # Apply overlay only inside fundus region
    mask3 = mask[..., None]
    blended = (base_bgr * (1.0 - mask3) + mixed * mask3).astype(np.uint8)

    ok, buf = cv2.imencode(".png", blended)
    if not ok:
        raise RuntimeError("png encode failed")
    return buf.tobytes()
