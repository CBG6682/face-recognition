"""
insightface wrapper: face detection + alignment + TTA embedding extraction
uses buffalo_s: RetinaFace (detect) + ArcFace (embed) with TTA (Test-Time Augmentation)
"""

import cv2
import numpy as np
import torch
from numpy.linalg import norm
from dataclasses import dataclass
from insightface.app import FaceAnalysis
from insightface.utils import face_align
from config import INSIGHT_FACE_MODEL, DET_SIZE, DET_THRESH, MAX_FACES, ALIGNED_FACE_SIZE


@dataclass
class DetectedFace:
    bbox: list[int]       # [x1, y1, x2, y2] in original image coords
    det_score: float
    embedding: list[float]  # 512-dim normalized ArcFace embedding


_app: FaceAnalysis | None = None


def load_model() -> FaceAnalysis:
    global _app
    if _app is None:
        providers = (
            ["CUDAExecutionProvider", "CPUExecutionProvider"]
            if torch.cuda.is_available()
            else ["CPUExecutionProvider"]
        )
        _app = FaceAnalysis(name=INSIGHT_FACE_MODEL, providers=providers)
        ctx = 0 if torch.cuda.is_available() else -1
        _app.prepare(ctx_id=ctx, det_size=DET_SIZE, det_thresh=DET_THRESH)
    return _app


def get_recognition_model(app: FaceAnalysis):
    """
    Lấy mô hình ArcFace (ONNX) để trích xuất feature vector trực tiếp.
    """
    rec_model = app.models.get("recognition")
    if rec_model is None:
        for v in app.models.values():
            if hasattr(v, "get_feat"):
                rec_model = v
                break
    return rec_model


# cached clahe and gamma lut tables to avoid reallocating per face
_clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(4, 4))
_GAMMA = 1.25
_INV_GAMMA = 1.0 / _GAMMA
_GAMMA_LUT = np.array(
    [((i / 255.0) ** _INV_GAMMA) * 255 for i in range(256)], dtype="uint8"
)


def get_face_variants(aligned_face: np.ndarray) -> list[np.ndarray]:
    """
    Tạo 5 biến thể kết hợp giữa TTA đối xứng và các phép biến đổi ánh sáng/màu sắc:
    1. Ảnh gốc
    2. Lật ngang (Triệt tiêu bóng đổ bất đối xứng)
    3. Khử màu (Triệt tiêu sai lệch tone da / ám màu camera)
    4. Cân bằng tương phản cục bộ CLAHE trên kênh Luminance (Làm rõ rãnh khối mặt)
    5. Hiệu chỉnh Gamma (Mô phỏng phơi sáng phi tuyến tính)
    """
    variants = []

    # 1. Ảnh gốc
    variants.append(aligned_face)

    # 2. Lật ngang (Horizontal Flip)
    variants.append(cv2.flip(aligned_face, 1))

    # 3. Khử màu (Grayscale 3 kênh)
    gray = cv2.cvtColor(aligned_face, cv2.COLOR_BGR2GRAY)
    variants.append(cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR))

    # 4. Cân bằng tương phản cục bộ (CLAHE trên kênh Y của YCrCb)
    ycrcb = cv2.cvtColor(aligned_face, cv2.COLOR_BGR2YCrCb)
    ycrcb[:, :, 0] = _clahe.apply(ycrcb[:, :, 0])
    clahe_face = cv2.cvtColor(ycrcb, cv2.COLOR_YCrCb2BGR)
    variants.append(clahe_face)

    # 5. Hiệu chỉnh Gamma (gamma = 1.25 giúp xử lý góc thiếu sáng/ngược sáng)
    gamma_face = cv2.LUT(aligned_face, _GAMMA_LUT)
    variants.append(gamma_face)

    return variants


def extract_tta_vectors(rec_model, aligned_face: np.ndarray) -> np.ndarray:
    """
    Trích xuất vector cho từng biến thể màu sắc và chuẩn hóa L2 đơn vị.
    Trả về: ma trận numpy shape (K, 512) với K là số biến thể (mặc định K=5).
    """
    variants = get_face_variants(aligned_face)
    vectors = []
    for var_img in variants:
        feat = rec_model.get_feat(var_img)
        feat_norm = feat / norm(feat)
        vectors.append(feat_norm.flatten())
    return np.array(vectors, dtype=np.float32)



def compute_face_embedding(rec_model, aligned_face: np.ndarray) -> list[float]:
    """
    Tính vector đặc trưng trung bình từ các biến thể TTA và chuẩn hóa L2.
    Trả về list[float] 512 chiều chuẩn hóa.
    """
    vectors = extract_tta_vectors(rec_model, aligned_face)
    mean_emb = np.mean(vectors, axis=0)
    mean_emb = mean_emb / norm(mean_emb)
    return mean_emb.astype(np.float32).tolist()


def _pad_to_target(
    img_bgr: np.ndarray, target: tuple[int, int] = DET_SIZE
) -> tuple[np.ndarray, float, int, int]:
    """
    scale down if larger than target, then pad with black border to reach target.
    returns (padded_img, scale, pad_left, pad_top)
    """
    h, w = img_bgr.shape[:2]
    scale = 1.0

    if h > target[0] or w > target[1]:
        scale = min(target[0] / h, target[1] / w)
        new_w, new_h = int(w * scale), int(h * scale)
        img_bgr = cv2.resize(img_bgr, (new_w, new_h))
        h, w = img_bgr.shape[:2]

    pad_h = target[0] - h
    pad_w = target[1] - w
    top = pad_h // 2
    left = pad_w // 2
    bottom = pad_h - top
    right = pad_w - left

    padded = cv2.copyMakeBorder(
        img_bgr, top, bottom, left, right, cv2.BORDER_CONSTANT, value=0
    )
    return padded, scale, left, top


def get_faces(
    img_bgr: np.ndarray, max_faces: int | None = MAX_FACES
) -> list[DetectedFace]:
    """
    detect all faces in img_bgr, align from original image, extract TTA embeddings.
    bbox coordinates are mapped back to original image space.
    """
    app = load_model()
    rec_model = get_recognition_model(app)
    h_org, w_org = img_bgr.shape[:2]
    padded, scale, pad_left, pad_top = _pad_to_target(img_bgr)

    raw_faces = app.get(padded)

    # 1. Lọc theo ngưỡng phát hiện và sắp xếp giảm dần theo det_score
    valid_faces = [f for f in raw_faces if f.det_score >= DET_THRESH]
    valid_faces.sort(key=lambda f: f.det_score, reverse=True)
    if max_faces is not None and max_faces > 0:
        valid_faces = valid_faces[:max_faces]

    results = []
    for face in valid_faces:
        px1, py1, px2, py2 = face.bbox
        x1 = max(0, int((px1 - pad_left) / scale))
        y1 = max(0, int((py1 - pad_top) / scale))
        x2 = min(w_org, int((px2 - pad_left) / scale))
        y2 = min(h_org, int((py2 - pad_top) / scale))

        # 2. Map 5 landmark (kps) về lại ảnh gốc để crop độ nét cao
        embedding = None
        if hasattr(face, "kps") and face.kps is not None and rec_model is not None:
            try:
                kps_org = face.kps.copy()
                kps_org[:, 0] = (kps_org[:, 0] - pad_left) / scale
                kps_org[:, 1] = (kps_org[:, 1] - pad_top) / scale

                aligned_face = face_align.norm_crop(
                    img_bgr, landmark=kps_org, image_size=ALIGNED_FACE_SIZE
                )
                if aligned_face is not None and aligned_face.size > 0:
                    embedding = compute_face_embedding(rec_model, aligned_face)
            except Exception:
                embedding = None

        # Fallback nếu crop hoặc TTA thất bại
        if embedding is None:
            if hasattr(face, "normed_embedding") and face.normed_embedding is not None:
                embedding = face.normed_embedding.tolist()
            else:
                embedding = [0.0] * 512

        results.append(
            DetectedFace(
                bbox=[x1, y1, x2, y2],
                det_score=float(face.det_score),
                embedding=embedding,
            )
        )

    return results

