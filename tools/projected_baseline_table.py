"""Generate projected baseline samples for Interferometry Baseline Lab."""

from __future__ import annotations

import csv
import math
from pathlib import Path


def main() -> None:
    baseline_m = 120.0
    declination_deg = 20.0
    output = Path(__file__).resolve().parents[1] / "data" / "projected_baseline.csv"
    output.parent.mkdir(exist_ok=True)
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["hour_angle_deg", "projected_baseline_m"])
        writer.writeheader()
        for hour_angle in range(-90, 91, 2):
            hour = math.radians(hour_angle)
            dec = math.radians(declination_deg)
            u_m = baseline_m * math.sin(hour)
            v_m = -baseline_m * math.sin(dec) * math.cos(hour)
            projected = math.sqrt(u_m**2 + v_m**2)
            writer.writerow({"hour_angle_deg": hour_angle, "projected_baseline_m": projected})
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
