#!/usr/bin/env python3
"""Retrieve official EHT M87 2017 calibrated Stokes-I visibility CSV products."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
OBSERVATIONS = ROOT / "data" / "observations"
OFFICIAL_RELEASE = "https://github.com/eventhorizontelescope/2019-D01-01"
RAW_BASE = "https://raw.githubusercontent.com/eventhorizontelescope/2019-D01-01/master/csv/"
DAYS = ("095", "096", "100", "101")
BANDS = ("hi", "lo")


def retrieve(filename: str) -> bytes:
    request = Request(RAW_BASE + filename, headers={"User-Agent": "Interferometry-Lab observation builder/1.0"})
    with urlopen(request, timeout=90) as response:
        return response.read()


def numeric_row_count(path: Path) -> int:
    count = 0
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            row = stripped.replace(",", " ").split()
            if len(row) < 8:
                continue
            try:
                for index in (3, 4, 5, 6, 7):
                    float(row[index])
            except ValueError:
                continue
            count += 1
    return count


def main() -> None:
    OBSERVATIONS.mkdir(parents=True, exist_ok=True)
    products = {}
    for day in DAYS:
        for band in BANDS:
            filename = f"SR1_M87_2017_{day}_{band}_hops_netcal_StokesI.csv"
            destination = OBSERVATIONS / filename
            destination.write_bytes(retrieve(filename))
            rows = numeric_row_count(destination)
            if rows < 1:
                raise ValueError(f"No calibrated visibility rows found in {filename}")
            products[f"{day}_{band}"] = {
                "file": filename,
                "officialUrl": RAW_BASE + filename,
                "bytes": destination.stat().st_size,
                "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
                "visibilityRows": rows,
            }
            print(f"Retrieved {filename}: {rows} visibility rows")
    metadata = {
        "dataset": "EHT Collaboration M87 2017 calibrated Stokes-I visibilities",
        "officialRelease": OFFICIAL_RELEASE,
        "sourceCsvBase": RAW_BASE,
        "productFamily": "SR1_M87_2017_<day>_<band>_hops_netcal_StokesI.csv",
        "days": list(DAYS),
        "bands": list(BANDS),
        "products": products,
        "processing": [
            "CSV products are retained locally unchanged from the public EHT release.",
            "Worker converts released amplitude and phase to complex visibility.",
            "Worker grids measured visibility and Hermitian conjugate samples before IFFT dirty-beam and dirty-image construction.",
            "Optional ring reference image is a separate model and never substitutes for observed visibilities.",
        ],
        "citation": "Event Horizon Telescope Collaboration et al., 2019. First M87 Event Horizon Telescope Results. III. Data Processing and Calibration. The Astrophysical Journal Letters, 875, L3.",
    }
    (OBSERVATIONS / "eht_m87_2017_metadata.json").write_text(
        json.dumps(metadata, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
