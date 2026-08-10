#!/usr/bin/env python3
"""Validate locally retained EHT M87 visibility products."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OBSERVATIONS = ROOT / "data" / "observations"


def check_csv(path: Path) -> int:
    rows = 0
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            row = stripped.replace(",", " ").split()
            if len(row) < 8:
                continue
            try:
                values = [float(row[index]) for index in (3, 4, 5, 6, 7)]
            except ValueError:
                continue
            if not all(math.isfinite(value) for value in values):
                raise ValueError(f"Non-finite released visibility in {path.name}")
            rows += 1
    return rows


def main() -> None:
    metadata = json.loads((OBSERVATIONS / "eht_m87_2017_metadata.json").read_text(encoding="utf-8"))
    if metadata["officialRelease"] != "https://github.com/eventhorizontelescope/2019-D01-01":
        raise ValueError("Official EHT release provenance is missing")
    total = 0
    for key, product in metadata["products"].items():
        path = OBSERVATIONS / product["file"]
        rows = check_csv(path)
        if rows != product["visibilityRows"]:
            raise ValueError(f"{key} row count differs from acquisition metadata")
        if hashlib.sha256(path.read_bytes()).hexdigest() != product["sha256"]:
            raise ValueError(f"{key} local CSV digest differs from acquisition metadata")
        total += rows
    print(f"Validated local EHT visibility products: {len(metadata['products'])} CSV files / {total} visibility rows")


if __name__ == "__main__":
    main()
