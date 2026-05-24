"""Validate simplified projected baseline and angular-resolution relationships."""

from __future__ import annotations

import csv
import math
from pathlib import Path


RAD_TO_MAS = 206264806.247


def projected_baseline(baseline_m: float, hour_deg: float, dec_deg: float) -> float:
    hour = math.radians(hour_deg)
    dec = math.radians(dec_deg)
    u_m = baseline_m * math.sin(hour)
    v_m = -baseline_m * math.sin(dec) * math.cos(hour)
    return math.sqrt(u_m**2 + v_m**2)


def resolution_mas(wavelength_um: float, projected_m: float) -> float:
    return RAD_TO_MAS * wavelength_um * 1e-6 / projected_m


def binary_visibility(u_lambda: float, v_lambda: float, separation_mas: float, position_angle_deg: float, flux_ratio: float) -> float:
    separation_rad = separation_mas / RAD_TO_MAS
    pa = math.radians(position_angle_deg)
    dx = separation_rad * math.sin(pa)
    dy = separation_rad * math.cos(pa)
    phase = -2 * math.pi * (u_lambda * dx + v_lambda * dy)
    real = (1 + flux_ratio * math.cos(phase)) / (1 + flux_ratio)
    imag = (flux_ratio * math.sin(phase)) / (1 + flux_ratio)
    return math.sqrt(real * real + imag * imag)


def main() -> None:
    b1 = projected_baseline(120.0, 35.0, 20.0)
    b2 = projected_baseline(240.0, 35.0, 20.0)
    res1 = resolution_mas(1.65, b1)
    res2 = resolution_mas(1.65, b2)
    sym_a = projected_baseline(120.0, 35.0, 20.0)
    sym_b = projected_baseline(120.0, -35.0, 20.0)
    visibility = binary_visibility(40e6, 12e6, 4.0, 35.0, 0.45)
    min_visibility = abs(1 - 0.45) / (1 + 0.45)

    output = Path(__file__).resolve().parents[1] / "data" / "validation_summary.csv"
    rows = [
        {"check": "baseline_doubling_resolution_ratio", "value": res2 / res1, "expected": 0.5, "passed": math.isclose(res2 / res1, 0.5, rel_tol=1e-12)},
        {"check": "hour_angle_symmetry", "value": abs(sym_a - sym_b), "expected": 0.0, "passed": math.isclose(sym_a, sym_b, rel_tol=1e-12)},
        {"check": "zero_declination_transit_projection", "value": projected_baseline(120.0, 0.0, 0.0), "expected": 0.0, "passed": math.isclose(projected_baseline(120.0, 0.0, 0.0), 0.0, abs_tol=1e-12)},
        {"check": "rad_to_mas_constant", "value": RAD_TO_MAS, "expected": 206264806.247, "passed": math.isclose(RAD_TO_MAS, 206264806.247)},
        {"check": "binary_visibility_bounds", "value": visibility, "expected": f"{min_visibility} <= |V| <= 1", "passed": min_visibility <= visibility <= 1.0},
    ]
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["check", "value", "expected", "passed"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
