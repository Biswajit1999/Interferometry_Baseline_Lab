"""Descriptive per-file closure and sampling summaries for retained EHT M87 CSV."""
from __future__ import annotations

import json
import math
from pathlib import Path
from statistics import median

from closure_diagnostics import (closure_amplitudes, closure_phases, leave_one_hour_out_uv,
                                 read_visibilities, uv_sampling_moments)

ROOT = Path(__file__).resolve().parents[1]
OBS = ROOT / "data" / "observations"


def main() -> None:
    metadata = json.loads((OBS / "eht_m87_2017_metadata.json").read_text())
    results = {}
    for key, product in sorted(metadata["products"].items()):
        rows = read_visibilities(OBS / product["file"])
        if len(rows) != product["visibilityRows"]:
            raise ValueError(f"row-count mismatch in {key}")
        phases = closure_phases(rows, min_snr=3)
        amplitudes = closure_amplitudes(rows, min_snr=3)
        moments = uv_sampling_moments(rows)
        hour_jk = leave_one_hour_out_uv(rows)
        results[key] = {
            "visibilities": len(rows), "high_snr_triangles": len(phases),
            "median_absolute_closure_phase_deg": median(abs(p["closure_phase_deg"]) for p in phases)
            if phases else None,
            "high_snr_quadrangles": len(amplitudes),
            "median_log_closure_amplitude": median(a["log_closure_amplitude"] for a in amplitudes)
            if amplitudes else None,
            "uv_axis_ratio": moments["uv_axis_ratio"] if math.isfinite(moments["uv_axis_ratio"]) else None,
            "leave_one_hour_out_uv_axis_ratio_range": [min(x["uv_axis_ratio"] for x in hour_jk),
                                                        max(x["uv_axis_ratio"] for x in hour_jk)]
            if hour_jk else None,
        }
    print(json.dumps({"release": metadata["dataset"], "interpretation":
                      "Descriptive closure and uv checks of repository-retained CSVs; original-file hashes unverified; not calibrated imaging or inference.",
                      "files": results}, indent=2))


if __name__ == "__main__":
    main()
