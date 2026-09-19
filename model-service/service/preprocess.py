"""preproc_v1 — MUST match training exactly (§12.3).
circle_crop_pad -> resize 300 INTER_AREA -> ImageNet normalize."""
import cv2
import numpy as np

IMG_SIZE = 300
MEAN = np.array([0.485, 0.456, 0.406])
STD = np.array([0.229, 0.224, 0.225])
PREPROC_VERSION = "preproc_v1"


def preprocess_with_image(image_bytes: bytes):
    """Returns (normalized NCHW float32, 300px RGB uint8)."""
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("undecodable image")
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    mask = gray > 10
    if mask.sum() >= 100:
        ys, xs = np.where(mask)
        img = img[ys.min():ys.max()+1, xs.min():xs.max()+1]
    h, w = img.shape[:2]
    s = max(h, w)
    t, l = (s - h) // 2, (s - w) // 2
    out = np.zeros((s, s, 3), dtype=img.dtype)
    out[t:t+h, l:l+w] = img
    img = cv2.resize(out, (IMG_SIZE, IMG_SIZE), interpolation=cv2.INTER_AREA)
    x = (img / 255.0 - MEAN) / STD
    return x.transpose(2, 0, 1).astype(np.float32)[None], img


def preprocess(image_bytes: bytes) -> np.ndarray:
    x, _ = preprocess_with_image(image_bytes)
    return x
