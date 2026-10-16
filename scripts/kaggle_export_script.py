# Kaggle export script: run this in a code cell on your kaggle notebook

import os
import json
import zipfile
import numpy as np
from numpy.linalg import norm
import cv2
from IPython.display import FileLink, display

# 1. specify folder containing your matched face results
MATCHED_DIR = "/kaggle/working/matched_results/face"
if not os.path.exists(MATCHED_DIR):
    # fallback to current working directory if custom path
    MATCHED_DIR = "/kaggle/working"

print(f"scanning faces in: {MATCHED_DIR}")

# 2. initialize insightface buffalo_s (matching production local model)
try:
    from insightface.app import FaceAnalysis
    app = FaceAnalysis(name="buffalo_s", providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
    app.prepare(ctx_id=0, det_size=(640, 640))
    has_insightface = True
except Exception as e:
    print(f"insightface init warning: {e}")
    has_insightface = False

# 3. collect images and extract embeddings
image_exts = {".png", ".jpg", ".jpeg", ".webp"}
image_files = [f for f in sorted(os.listdir(MATCHED_DIR)) if os.path.splitext(f)[1].lower() in image_exts]

print(f"found {len(image_files)} images")

results = []
top_zip_files = []

for idx, fname in enumerate(image_files, start=1):
    fpath = os.path.join(MATCHED_DIR, fname)
    img = cv2.imread(fpath)
    if img is None:
        continue

    embedding = None
    if has_insightface:
        faces = app.get(img)
        if faces:
            # pick the most prominent face
            faces = sorted(faces, key=lambda x: (x.bbox[2]-x.bbox[0]) * (x.bbox[3]-x.bbox[1]), reverse=True)
            emb = faces[0].embedding
            emb_norm = emb / norm(emb)
            embedding = emb_norm.astype(float).tolist()

    if embedding is not None:
        results.append({
            "rank": idx,
            "filename": fname,
            "embedding": embedding
        })
        top_zip_files.append(fpath)
        if idx <= 5:
            print(f"extracted embedding for {fname} (512 floats)")

# 4. save embeddings to distractor_faces.json (very lightweight, ~50KB)
json_out = "/kaggle/working/distractor_faces.json"
with open(json_out, "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)

print(f"\nexported {len(results)} face embeddings to {json_out} ({os.path.getsize(json_out) / 1024:.1f} KB)")

# 5. create zip archive of matched face images
zip_out = "/kaggle/working/distractor_images.zip"
with zipfile.ZipFile(zip_out, "w", zipfile.ZIP_DEFLATED) as zf:
    for fpath in top_zip_files[:100]:
        zf.write(fpath, arcname=os.path.basename(fpath))

print(f"created image zip: {zip_out} ({os.path.getsize(zip_out) / 1024:.1f} KB)")

# 6. display clickable download links in kaggle notebook
print("\nclick links below to download directly to your computer:")
display(FileLink("distractor_faces.json"))
display(FileLink("distractor_images.zip"))
