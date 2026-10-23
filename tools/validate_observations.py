#!/usr/bin/env python3
"""Verify retained EHT CSV data against official acquisition hashes.

Git normalised the original release's CRLF line endings to LF in this repo.
Reconstruct CRLF solely for digest verification; do not rewrite the cached CSV.
"""
from __future__ import annotations

import csv
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OBSERVATIONS = ROOT / "data" / "observations"


def release_crlf_bytes(raw: bytes) -> bytes:
    """Reconstruct release-style CRLF from a Git-LF or already-CRLF CSV.

    Refuse unexpected lone carriage returns; otherwise canonicalisation is
    deterministic and does not modify any numerical text or the source file.
    """
    lf = raw.replace(b"\r\n", b"\n")
    if b"\r" in lf:
        raise ValueError("unexpected standalone carriage return in CSV")
    return lf.replace(b"\n", b"\r\n")


def check_csv(path: Path) -> int:
    rows = 0
    with path.open("r", encoding="utf-8", newline="") as handle:
        for row in csv.reader(handle):
            if not row or row[0].startswith("#"):
                continue
            if len(row) != 8:
                raise ValueError(f"invalid EHT CSV row in {path.name}")
            try:
                numbers = [float(row[i]) for i in (0, 3, 4, 5, 6, 7)]
            except ValueError as exc:
                raise ValueError(f"invalid EHT numeric data in {path.name}") from exc
            if (not all(math.isfinite(v) for v in numbers)
                    or numbers[3] <= 0 or numbers[5] <= 0):
                raise ValueError(f"invalid EHT visibility amplitude or sigma in {path.name}")
            rows += 1
    return rows


def validate_product(path: Path, product: dict) -> tuple[int, str]:
    count = check_csv(path)
    if count != product["visibilityRows"]:
        raise ValueError(f"{path.name}: {count} rows != expected {product['visibilityRows']}")
    raw = path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if digest == product["sha256"] and len(raw) == product["bytes"]:
        return count, "original bytes"
    restored = release_crlf_bytes(raw)
    if (len(restored) != product["bytes"]
            or hashlib.sha256(restored).hexdigest() != product["sha256"]):
        raise ValueError(f"{path.name}: source SHA-256 does not match, even after CRLF restoration")
    return count, "LF-normalised; CRLF restoration matches original SHA-256"


def main() -> None:
    metadata = json.loads((OBSERVATIONS / "eht_m87_2017_metadata.json").read_text(encoding="utf-8"))
    if metadata["officialRelease"] != "https://github.com/eventhorizontelescope/2019-D01-01":
        raise ValueError("EHT release provenance missing")
    total = 0
    modes = {}
    for key, product in metadata["products"].items():
        count, mode = validate_product(OBSERVATIONS / product["file"], product)
        total += count
        modes[key] = mode
    print(f"Validated EHT release hashes: {len(modes)} CSV files / {total} rows")
    for key, mode in sorted(modes.items()):
        print(f"  {key}: {mode}")


if __name__ == "__main__":
    main()
