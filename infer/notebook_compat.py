"""
compatibility layer and utilities from ce201.ipynb experiment notebook
provides in-memory database and multi-face evaluation helper functions
"""

import os
import pickle
import cv2
import numpy as np
from numpy.linalg import norm
from insightface.utils import face_align
from config import (
    DET_SIZE,
    DET_THRESH,
    LIVENESS_THRESH,
    RECOG_THRESH,
    MAX_FACES,
    ALIGNED_FACE_SIZE,
)
from detector import (
    load_model,
    get_recognition_model,
    extract_tta_vectors,
    compute_face_embedding,
    letterbox_image,
)
from liveness import check_liveness


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
    db: dict[str, np.ndarray],
    paths: list[str],
    ids: list[str],
    app=None,
    target_size: tuple[int, int] = DET_SIZE,
    tta_mode: str | None = None,
) -> None:
    """
    Chuẩn hóa ảnh hồ sơ về khung img_padded (640x640) bằng letterbox,
    sau đó cắt mặt 112x112 trực tiếp trên img_padded và gom trung bình TTA.
    """
    if app is None:
        app = load_model()
    rec_model = get_recognition_model(app)

    for path, person_id in zip(paths, ids):
        img_bgr = cv2.imread(str(path))
        if img_bgr is None:
            continue

        img_padded, _, _, _, _ = letterbox_image(img_bgr, target_size=target_size)
        faces = app.get(img_padded)
        if not faces:
            continue

        # choose face with largest bbox area
        target_face = max(
            faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1])
        )

        # crop directly on img_padded without mapping back
        if hasattr(target_face, "kps") and target_face.kps is not None and rec_model is not None:
            try:
                aligned_face = face_align.norm_crop(
                    img_padded, landmark=target_face.kps, image_size=ALIGNED_FACE_SIZE
                )
                if aligned_face is not None and aligned_face.size > 0:
                    vectors = extract_tta_vectors(
                        rec_model, aligned_face, tta_mode=tta_mode
                    )
                    mean_emb = np.mean(vectors, axis=0)
                    mean_emb = mean_emb / norm(mean_emb)
                    db[str(person_id)] = mean_emb.astype(np.float32)
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
    target_size: tuple[int, int] = DET_SIZE,
    det_thresh: float = DET_THRESH,
    liveness_thresh: float = LIVENESS_THRESH * 100.0,
    recog_thresh: float = RECOG_THRESH,
    max_faces: int = MAX_FACES,
    check_liveness_flag: bool = True,
    tta_mode: str | None = None,
) -> list[dict]:
    """
    Xử lý khung hình điểm danh đa mặt đối chiếu với database in-memory:
    - Chuẩn hóa kích thước bằng letterbox_image (giữ nguyên tỉ lệ H:W, bù pad đen).
    - BBox hiển thị và cắt liveness được quy đổi về tọa độ frame_org.
    - Cắt mặt 112x112 để nhận diện được thực hiện trực tiếp trên frame_padded (640x640).
    - Kết hợp 50% Mean Vector + 50% Top-3 Variants (khử nhiễu lóa kính).
    """
    final_results = []
    if not db or frame_org is None:
        return final_results

    if app is None:
        app = load_model()
    rec_model = get_recognition_model(app)

    db_ids = list(db.keys())
    db_matrix = np.array(list(db.values()), dtype=np.float32)

    h_org, w_org = frame_org.shape[:2]

    # letterbox scale and face detection
    frame_padded, pad_left, pad_top, scale_x, scale_y = letterbox_image(
        frame_org, target_size=target_size
    )

    faces = app.get(frame_padded)
    valid_faces = [f for f in faces if f.det_score >= det_thresh]
    valid_faces.sort(key=lambda f: f.det_score, reverse=True)
    if max_faces is not None and max_faces > 0:
        valid_faces = valid_faces[:max_faces]

    # process each face
    for face in valid_faces:
        px1, py1, px2, py2 = face.bbox
        x1 = max(0, int(round((px1 - pad_left) / scale_x)))
        y1 = max(0, int(round((py1 - pad_top) / scale_y)))
        x2 = min(w_org, int(round((px2 - pad_left) / scale_x)))
        y2 = min(h_org, int(round((py2 - pad_top) / scale_y)))

        face_result = {
            "bbox": [x1, y1, x2, y2],
            "det_score": float(face.det_score),
            "liveness": {"score": 0.0, "label": "Fake"},
            "recognition": {"similarity": 0.0, "matched_id": "Unknown"},
            "status": "Không xác định",
        }

        is_real = False

        # check liveness
        if check_liveness_flag:
            label, score = check_liveness(frame_org, [x1, y1, x2, y2])
            liveness_percent = round(score * 100.0, 2)
            face_result["liveness"]["score"] = liveness_percent
            face_result["liveness"]["label"] = label
            is_real = (label == "Real")

        # recognition on padded frame
        if hasattr(face, "kps") and face.kps is not None and rec_model is not None:
            try:
                aligned_face = face_align.norm_crop(
                    frame_padded, landmark=face.kps, image_size=ALIGNED_FACE_SIZE
                )
                query_vectors = extract_tta_vectors(
                    rec_model, aligned_face, tta_mode=tta_mode
                )

                query_mean_vec = np.mean(query_vectors, axis=0)
                query_mean_vec = query_mean_vec / norm(query_mean_vec)

                # cosine similarity matrix: (K, 512) x (512, N_db) -> (K, N_db)
                sim_matrix = np.dot(query_vectors, db_matrix.T)

                # combine 50% mean vector and 50% top-3 variants
                num_variants = sim_matrix.shape[0]
                k_top = min(3, num_variants)
                top_variant_sims = np.sort(sim_matrix, axis=0)[-k_top:, :]
                mean_sims = 0.5 * np.dot(query_mean_vec, db_matrix.T) + 0.5 * np.mean(
                    top_variant_sims, axis=0
                )

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

        # aggregate status
        if check_liveness_flag and not is_real:
            face_result["status"] = f"Từ chối: Giả mạo (ID nghi vấn: {best_id})"
        elif best_id == "Unknown":
            face_result["status"] = "Từ chối: Người lạ"
        else:
            face_result["status"] = f"Điểm danh thành công: {best_id}"

        final_results.append(face_result)

    return final_results
