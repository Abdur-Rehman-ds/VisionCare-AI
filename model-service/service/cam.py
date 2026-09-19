"""Eigen-CAM attention maps (FR-4.5, amended per §21C).

Grad-CAM needs gradients; ONNX inference has none. Eigen-CAM
(Muhammad & Yeasin, 2020) projects the last conv feature maps onto
their first principal component — gradient-free, forward-only, and
faithful to "where did the model look". At startup we graph-surgery
the production ONNX to also expose the tensor feeding the global
pooling node; no second model file, no torch."""
from pathlib import Path

import cv2
import numpy as np
import onnx


def build_cam_model(src: Path, dst: Path) -> str:
    """Add the pre-pooling feature map as an extra graph output.
    Returns the tensor name to fetch."""
    m = onnx.load(str(src))
    pool_nodes = [n for n in m.graph.node
                  if n.op_type in ("GlobalAveragePool", "ReduceMean",
                                   "AveragePool")]
    if not pool_nodes:
        raise RuntimeError("no pooling node found for CAM")
    feat_name = pool_nodes[-1].input[0]
    vi = onnx.helper.make_tensor_value_info(feat_name,
                                            onnx.TensorProto.FLOAT, None)
    m.graph.output.append(vi)
    onnx.save(m, str(dst))
    return feat_name


def eigen_cam(features: np.ndarray) -> np.ndarray:
    """(1, C, H, W) float32 -> (H, W) float in [0, 1]."""
    f = features[0]                       # C, H, W
    c, h, w = f.shape
    m = f.reshape(c, h * w).T             # HW x C
    m = m - m.mean(axis=0, keepdims=True)
    _, _, vt = np.linalg.svd(m, full_matrices=False)
    cam = m @ vt[0]                       # HW
    if cam.max() < -cam.min():            # sign is arbitrary — flip so
        cam = -cam                        # the dominant response is +
    cam = np.maximum(cam, 0).reshape(h, w)
    if cam.max() > 0:
        cam = cam / cam.max()
    return cam


def overlay(cam: np.ndarray, img300_rgb: np.ndarray) -> bytes:
    """Blend the heatmap over the preprocessed 300px image -> PNG."""
    heat = cv2.resize(cam, (img300_rgb.shape[1], img300_rgb.shape[0]),
                      interpolation=cv2.INTER_LINEAR)
    heat_u8 = (heat * 255).astype(np.uint8)
    heat_color = cv2.applyColorMap(heat_u8, cv2.COLORMAP_JET)
    base_bgr = cv2.cvtColor(img300_rgb, cv2.COLOR_RGB2BGR)
    blended = cv2.addWeighted(base_bgr, 0.55, heat_color, 0.45, 0)
    ok, buf = cv2.imencode(".png", blended)
    if not ok:
        raise RuntimeError("png encode failed")
    return buf.tobytes()
