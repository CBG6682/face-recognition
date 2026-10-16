"""
MiniFASNetV2 wrapper: anti-spoofing liveness detection
depends on cloned repo: Silent-Face-Anti-Spoofing/
"""

import os
import sys
import cv2
import numpy as np
import torch
from config import (
    ANTI_SPOOF_DIR,
    ANTI_SPOOF_MODEL,
    ANTI_SPOOF_CAFFE_MODEL,
    ANTI_SPOOF_CAFFE_DEPLOY,
    LIVENESS_THRESH,
    LIVENESS_MARGIN,
)

# allow older state_dict files in newer pytorch versions
_orig_torch_load = torch.load


def _safe_torch_load(*args, **kwargs):
    if "weights_only" not in kwargs:
        kwargs["weights_only"] = False
    return _orig_torch_load(*args, **kwargs)


torch.load = _safe_torch_load

# add repo to path once at import
if ANTI_SPOOF_DIR not in sys.path:
    sys.path.insert(0, ANTI_SPOOF_DIR)

from src.anti_spoof_predict import AntiSpoofPredict, Detection
from src.generate_patches import CropImage
from src.utility import parse_model_name

# Vá đè __init__ của Detection để nạp Caffe model theo đường dẫn tuyệt đối (Cell 18 trong ce201.ipynb)
def _patched_det_init(self):
    if os.path.exists(ANTI_SPOOF_CAFFE_DEPLOY) and os.path.exists(ANTI_SPOOF_CAFFE_MODEL):
        try:
            self.detector = cv2.dnn.readNetFromCaffe(
                ANTI_SPOOF_CAFFE_DEPLOY, ANTI_SPOOF_CAFFE_MODEL
            )
            self.detector_confidence = 0.6
            return
        except Exception:
            pass
    self.detector = None
    self.detector_confidence = 0.6


def _safe_get_bbox(self, img):
    if getattr(self, "detector", None) is None:
        return [0, 0, 0, 0]
    try:
        return Detection.get_bbox(self, img)
    except Exception:
        return [0, 0, 0, 0]


Detection.__init__ = _patched_det_init
Detection.get_bbox = _safe_get_bbox


_predictor: AntiSpoofPredict | None = None
_cropper: CropImage | None = None


def _get_models() -> tuple[AntiSpoofPredict, CropImage]:
    global _predictor, _cropper
    if _predictor is None:
        device_id = 0 if torch.cuda.is_available() else -1
        _predictor = AntiSpoofPredict(device_id)
        _cropper = CropImage()
    return _predictor, _cropper


def check_liveness(img_bgr: np.ndarray, bbox: list[int]) -> tuple[str, float]:
    """
    run MiniFASNetV2 on the face region (with margin) to detect spoof.
    returns ("Real" | "Fake", confidence_score 0.0 - 1.0)

    bbox: [x1, y1, x2, y2] in img_bgr coords
    """
    try:
        predictor, cropper = _get_models()
        h, w = img_bgr.shape[:2]
        x1, y1, x2, y2 = bbox

        face_w = x2 - x1
        face_h = y2 - y1
        if face_w <= 0 or face_h <= 0:
            return "Fake", 0.0

        margin_x = int(face_w * LIVENESS_MARGIN)
        margin_y = int(face_h * LIVENESS_MARGIN)

        ex1 = max(0, x1 - margin_x)
        ey1 = max(0, y1 - margin_y)
        ex2 = min(w, x2 + margin_x)
        ey2 = min(h, y2 + margin_y)

        sub_img = img_bgr[ey1:ey2, ex1:ex2]
        if sub_img.size == 0:
            return "Fake", 0.0

        # use exact face bbox coordinates within sub_img from insightface
        detected_bbox = [margin_x, margin_y, face_w, face_h]

        model_name = os.path.basename(ANTI_SPOOF_MODEL)
        h_in, w_in, _, scale = parse_model_name(model_name)
        param = {
            "org_img": sub_img,
            "bbox": detected_bbox,
            "scale": scale,
            "out_w": w_in,
            "out_h": h_in,
            "crop": True,
        }
        img_crop = cropper.crop(**param)
        pred = predictor.predict(img_crop, ANTI_SPOOF_MODEL)

        real_score = float(pred[0][1])
        label = "Real" if real_score >= LIVENESS_THRESH else "Fake"
        return label, real_score

    except Exception:
        return "Fake", 0.0

