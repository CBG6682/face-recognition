"""
main inference pipeline: combines detector + liveness into one call.
this is what app.py calls per request, and provides all functions from ce201.ipynb.
"""

import os
import pickle
import cv2
import numpy as np
from numpy.linalg import norm
from dataclasses import dataclass
from insightface.utils import face_align
from config import (
    DET_THRESH,
    LIVENESS_THRESH,
    RECOG_THRESH,
    MAX_FACES,
    ALIGNED_FACE_SIZE,
    ANTI_SPOOF_MODEL,
    LIVENESS_MARGIN,
)
from detector import (
    get_faces,
    DetectedFace,
    load_model,
    get_recognition_model,
    extract_tta_vectors,
    compute_face_embedding,
    _pad_to_target,
)
from liveness import check_liveness, _get_models


@dataclass
class FaceResult:
    bbox: list[int]
    det_score: float
    embedding: list[float]       # 512-dim, normalized (with TTA)
    liveness_label: str          # "Real" | "Fake"
    liveness_score: float        # 0.0 - 1.0


def process_frame(
    img_bgr: np.ndarray, max_faces: int | None = None
) -> list[FaceResult]:
    """
    run full pipeline on a single frame.
    returns one FaceResult per detected face, regardless of liveness outcome.
    go-side decides what to do with fake faces.
    """
    faces: list[DetectedFace] = get_faces(img_bgr, max_faces=max_faces)
    results: list[FaceResult] = []

    for face in faces:
        label, score = check_liveness(img_bgr, face.bbox)
        results.append(
            FaceResult(
                bbox=face.bbox,
                det_score=face.det_score,
                embedding=face.embedding,
                liveness_label=label,
                liveness_score=score,
            )
        )

    return results


def cos_sim(e1: np.ndarray | None, e2: np.ndarray | None) -> float:
    """
    Đo độ tương đồng Cosine giữa 2 vector đặc trưng 512 chiều.
    """
    if e1 is None or e2 is None:
        return 0.0
    dot = np.dot(e1, e2)
    norm_val = norm(e1) * norm(e2)
    if norm_val == 0:
        return 0.0
    return float(dot / norm_val)


def load_database(db_path: str) -> dict[str, np.ndarray]:
    """
    Nạp database khuôn mặt từ file .pkl.
    Trả về dict chuẩn hóa: {person_id: normalized_embedding_512}
    """
    if not os.path.exists(db_path):
        print(f"Không tìm thấy file: {db_path}")
        return {}

    with open(db_path, "rb") as f:
        data = pickle.load(f)

    db: dict[str, np.ndarray] = {}
    if isinstance(data, dict):
        if "embeddings" in data and "labels" in data:
            for emb, label in zip(data["embeddings"], data["labels"]):
                emb_norm = emb / norm(emb)
                db[str(label)] = emb_norm.astype(np.float32)
        else:
            for person_id, emb in data.items():
                emb_norm = emb / norm(emb)
                db[str(person_id)] = emb_norm.astype(np.float32)

    return db


def add_to_database(
    db: dict[str, np.ndarray], paths: list[str], ids: list[str], app=None
) -> None:
    """
    Trích xuất vector từ ảnh hồ sơ vào database in-memory (Cell 12).
    Áp dụng gom trung bình TTA và crop từ ảnh gốc để vector lưu trữ chuẩn mực nhất.
    """
    if app is None:
        app = load_model()
    rec_model = get_recognition_model(app)

    for path, person_id in zip(paths, ids):
        img_bgr = cv2.imread(path)
        if img_bgr is None:
            continue

        padded, scale, pad_left, pad_top = _pad_to_target(img_bgr)
        faces = app.get(padded)
        if not faces:
            continue

        # Chọn khuôn mặt có diện tích lớn nhất
        target_face = max(
            faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1])
        )

        # Map 5 landmark về lại ảnh gốc
        if hasattr(target_face, "kps") and target_face.kps is not None and rec_model is not None:
            try:
                kps_org = target_face.kps.copy()
                kps_org[:, 0] = (kps_org[:, 0] - pad_left) / scale
                kps_org[:, 1] = (kps_org[:, 1] - pad_top) / scale

                aligned_face = face_align.norm_crop(
                    img_bgr, landmark=kps_org, image_size=ALIGNED_FACE_SIZE
                )
                if aligned_face is not None and aligned_face.size > 0:
                    embedding = compute_face_embedding(rec_model, aligned_face)
                    db[str(person_id)] = np.array(embedding, dtype=np.float32)
                    continue
            except Exception:
                pass

        if hasattr(target_face, "normed_embedding") and target_face.normed_embedding is not None:
            emb = target_face.normed_embedding
            db[str(person_id)] = (emb / norm(emb)).astype(np.float32)


def process_multi_face_frame(
    frame_org: np.ndarray,
    db: dict[str, np.ndarray],
    app=None,
    det_thresh: float = DET_THRESH,
    liveness_thresh: float = LIVENESS_THRESH * 100.0,
    recog_thresh: float = RECOG_THRESH,
    max_faces: int = MAX_FACES,
    check_liveness_flag: bool = True,
) -> list[dict]:
    """
    Hàm xử lý khung hình điểm danh đa mặt đối chiếu với database in-memory (Cell 12 trong ce201.ipynb):
    - Lọc và sắp xếp các mặt theo det_score cao nhất.
    - Căn chỉnh từ ảnh gốc và áp dụng TTA (Gốc, Lật ngang, Grayscale).
    - Tính toán song song cả Liveness và Recognition (không ngắt nhận diện khi là Fake).
    """
    final_results = []
    if not db:
        return final_results

    if app is None:
        app = load_model()
    rec_model = get_recognition_model(app)

    db_ids = list(db.keys())
    db_matrix = np.array(list(db.values()), dtype=np.float32)

    # 1. Phát hiện khuôn mặt
    h_org, w_org = frame_org.shape[:2]
    padded, scale, pad_left, pad_top = _pad_to_target(frame_org)

    faces = app.get(padded)
    valid_faces = [f for f in faces if f.det_score >= det_thresh]
    valid_faces.sort(key=lambda f: f.det_score, reverse=True)
    if max_faces is not None and max_faces > 0:
        valid_faces = valid_faces[:max_faces]

    # 2. Xử lý từng khuôn mặt
    for face in valid_faces:
        px1, py1, px2, py2 = face.bbox
        x1 = max(0, int((px1 - pad_left) / scale))
        y1 = max(0, int((py1 - pad_top) / scale))
        x2 = min(w_org, int((px2 - pad_left) / scale))
        y2 = min(h_org, int((py2 - pad_top) / scale))

        face_result = {
            "bbox": [x1, y1, x2, y2],
            "det_score": float(face.det_score),
            "liveness": {"score": 0.0, "label": "Fake"},
            "recognition": {"similarity": 0.0, "matched_id": "Unknown"},
            "status": "Không xác định",
        }

        is_real = False

        # 2.1 Kiểm tra Liveness
        if check_liveness_flag:
            label, score = check_liveness(frame_org, [x1, y1, x2, y2])
            liveness_percent = round(score * 100.0, 2)
            face_result["liveness"]["score"] = liveness_percent
            face_result["liveness"]["label"] = label
            is_real = (label == "Real")

        # 2.2 Nhận diện với TTA Vector Matching (luôn chạy)
        embedding_vec = None
        if hasattr(face, "kps") and face.kps is not None and rec_model is not None:
            try:
                kps_org = face.kps.copy()
                kps_org[:, 0] = (kps_org[:, 0] - pad_left) / scale
                kps_org[:, 1] = (kps_org[:, 1] - pad_top) / scale

                aligned_face = face_align.norm_crop(
                    frame_org, landmark=kps_org, image_size=ALIGNED_FACE_SIZE
                )
                query_vectors = extract_tta_vectors(rec_model, aligned_face)

                # Ma trận tương đồng Cosine: (3, 512) x (512, N_db) -> (3, N_db)
                sim_matrix = np.dot(query_vectors, db_matrix.T)
                mean_sims = np.mean(sim_matrix, axis=0)

                best_idx = int(np.argmax(mean_sims))
                best_avg_sim = float(mean_sims[best_idx])

                if best_avg_sim >= recog_thresh:
                    best_id = db_ids[best_idx]
                else:
                    best_id = "Unknown"

                face_result["recognition"]["similarity"] = round(best_avg_sim * 100, 2)
                face_result["recognition"]["matched_id"] = best_id
            except Exception:
                face_result["recognition"]["matched_id"] = "Unknown"
                face_result["recognition"]["similarity"] = 0.0
        else:
            face_result["recognition"]["matched_id"] = "Unknown"
            face_result["recognition"]["similarity"] = 0.0

        best_id = face_result["recognition"]["matched_id"]

        # 2.3 Tổng hợp trạng thái
        if check_liveness_flag and not is_real:
            face_result["status"] = f"Từ chối: Giả mạo (ID nghi vấn: {best_id})"
        elif best_id == "Unknown":
            face_result["status"] = "Từ chối: Người lạ"
        else:
            face_result["status"] = f"Điểm danh thành công: {best_id}"

        final_results.append(face_result)

    return final_results

