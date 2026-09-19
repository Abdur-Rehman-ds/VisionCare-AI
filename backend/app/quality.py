"""Image quality gate (FR-3.2) — cheap CPU checks BEFORE the model.

A rejected image never reaches analysis; the reason is stored and
shown to the user so they can re-capture. Thresholds are deliberately
lenient: the gate catches garbage (blur, black frames, non-images),
not borderline clinical quality — that judgment belongs to the doctor.
"""
import cv2
import numpy as np

MIN_SIDE = 300          # too small to grade
BLUR_THRESHOLD = 40.0   # variance of Laplacian below this = blurry
DARK_THRESHOLD = 25.0   # mean intensity below this = mostly black
BRIGHT_THRESHOLD = 235.0


def check_quality(image_bytes: bytes) -> tuple[bool, str | None, str | None]:
    """Returns (passed, reason_code, reason_message)."""
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return False, "unreadable", "File could not be decoded as an image"
    h, w = img.shape[:2]
    if min(h, w) < MIN_SIDE:
        return False, "too_small", f"Image is {w}x{h}; minimum side is {MIN_SIDE}px"
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    mean = float(gray.mean())
    if mean < DARK_THRESHOLD:
        return False, "too_dark", "Image is too dark to assess"
    if mean > BRIGHT_THRESHOLD:
        return False, "overexposed", "Image is overexposed"
    blur = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    if blur < BLUR_THRESHOLD:
        return False, "blurry", "Image appears too blurred for assessment"
    return True, None, None
