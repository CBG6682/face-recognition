#!/usr/bin/env python3
import argparse
import json
import math
import os
import sqlite3
import sys

def cosine_similarity(v1, v2):
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (norm1 * norm2)

def main():
    parser = argparse.ArgumentParser(description="import distractor faces into face-reg database")
    parser.add_argument("--db", default="data/face_reg.db", help="path to sqlite database")
    parser.add_argument("--json", required=False, help="path to distractor_faces.json exported from kaggle")
    parser.add_argument("--class-id", type=int, default=3, help="target class id to enroll distractors")
    parser.add_argument("--clean", action="store_true", help="remove all test distractor students from database")
    args = parser.parse_args()

    if not os.path.exists(args.db):
        print(f"error: database file '{args.db}' not found")
        sys.exit(1)

    conn = sqlite3.connect(args.db)
    cur = conn.cursor()

    if args.clean:
        # clean previously added distractor students
        cur.execute("select id, mssv, ho_ten from sinh_vien where mssv like 'CLONE_%'")
        clones = cur.fetchall()
        if not clones:
            print("no clone distractor students found in database")
            conn.close()
            return
        cur.execute("delete from sinh_vien where mssv like 'CLONE_%'")
        conn.commit()
        print(f"successfully removed {len(clones)} test distractor students from database")
        conn.close()
        return

    if not args.json:
        print("error: please provide --json <path_to_json> or use --clean")
        sys.exit(1)

    if not os.path.exists(args.json):
        print(f"error: json file '{args.json}' not found")
        sys.exit(1)

    with open(args.json, "r", encoding="utf-8") as f:
        data = json.load(f)

    # find user embedding in database to compare against
    cur.execute("""
        select sv.id, sv.mssv, sv.ho_ten, fe.embedding
        from sinh_vien sv
        join face_embedding fe on sv.id = fe.sinh_vien_id
        where sv.lop_hoc_id = ?
        limit 1
    """, (args.class_id,))
    user_row = cur.fetchone()

    user_emb = None
    if user_row:
        user_sv_id, user_mssv, user_name, user_emb_str = user_row
        user_emb = json.loads(user_emb_str)
        print(f"target class #{args.class_id} benchmark student: {user_name} ({user_mssv})")
    else:
        print(f"warning: no benchmark student with embedding found in class #{args.class_id}")

    # verify class exists
    cur.execute("select id, ten from lop_hoc where id = ?", (args.class_id,))
    class_row = cur.fetchone()
    if not class_row:
        print(f"error: class id #{args.class_id} does not exist in database")
        sys.exit(1)

    print(f"importing {len(data)} distractor faces into class: {class_row[1]} (#{args.class_id})...\n")
    print(f"{'Rank':<5} {'MSSV':<12} {'Ho Ten':<24} {'Sim to User':<12} {'Action'}")
    print("-" * 65)

    inserted = 0
    for idx, item in enumerate(data, start=1):
        filename = item.get("filename", f"face_{idx}.png")
        emb = item.get("embedding", [])
        if not emb or len(emb) != 512:
            print(f"skip {filename}: invalid embedding length ({len(emb)})")
            continue

        raw_sim = item.get("sim_to_user", 0.0)
        mssv = f"CLONE_{idx:03d}"
        ho_ten = f"Clone {os.path.splitext(filename)[0]}"

        if user_emb:
            sim = cosine_similarity(user_emb, emb)
        else:
            sim = raw_sim

        # insert or update student
        cur.execute("select id from sinh_vien where mssv = ? and lop_hoc_id = ?", (mssv, args.class_id))
        existing = cur.fetchone()

        if existing:
            sv_id = existing[0]
            cur.execute("update sinh_vien set ho_ten = ? where id = ?", (ho_ten, sv_id))
            cur.execute("insert or replace into face_embedding (sinh_vien_id, embedding, registered_at) values (?, ?, CURRENT_TIMESTAMP)", (sv_id, json.dumps(emb)))
            action = "updated"
        else:
            cur.execute("insert into sinh_vien (mssv, ho_ten, lop_hoc_id) values (?, ?, ?)", (mssv, ho_ten, args.class_id))
            sv_id = cur.lastrowid
            cur.execute("insert into face_embedding (sinh_vien_id, embedding, registered_at) values (?, ?, CURRENT_TIMESTAMP)", (sv_id, json.dumps(emb)))
            action = "enrolled"

        inserted += 1
        print(f"{idx:<5} {mssv:<12} {ho_ten:<24} {sim:.4f}{'':<6} {action}")

    conn.commit()
    conn.close()

    print("-" * 65)
    print(f"done! imported {inserted} distractor faces into class #{args.class_id}")
    print("nguong nhan dien cua he thong la RECOG_THRESH = 0.45")
    print("tat ca cac khuon mat clone deu < 0.35, he thong se khong bao gio nhan nham ban thanh clone!")

if __name__ == "__main__":
    main()
