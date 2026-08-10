"""Generate a reference uv/visibility track for the synthesis-imaging laboratory."""

from __future__ import annotations

import csv
import math
from pathlib import Path

ARCSEC_TO_RADIANS = math.pi / (180.0 * 3600.0)


def project(
    baseline: tuple[float, float, float],
    wavelength_m: float,
    hour_hours: float,
    declination_deg: float,
) -> tuple[float, float]:
    bx, by, bz = baseline
    hour = hour_hours * math.pi / 12.0
    declination = math.radians(declination_deg)
    u = (bx * math.sin(hour) + by * math.cos(hour)) / wavelength_m
    v = (
        -bx * math.sin(declination) * math.cos(hour)
        + by * math.sin(declination) * math.sin(hour)
        + bz * math.cos(declination)
    ) / wavelength_m
    return u, v


def visibility(
    u: float, v: float, source_fwhm_arcsec: float = 1.2, separation_arcsec: float = 4.0,
    flux_ratio: float = 0.55, position_angle_deg: float = 38.0
) -> complex:
    sigma = source_fwhm_arcsec * ARCSEC_TO_RADIANS / (2.0 * math.sqrt(2.0 * math.log(2.0)))
    separation = separation_arcsec * ARCSEC_TO_RADIANS
    angle = math.radians(position_angle_deg)
    l2, m2 = separation * math.sin(angle), separation * math.cos(angle)
    envelope = math.exp(-2.0 * math.pi**2 * sigma**2 * (u**2 + v**2))
    phase = -2.0 * math.pi * (u * l2 + v * m2)
    return envelope * (1.0 + flux_ratio * complex(math.cos(phase), math.sin(phase))) / (1.0 + flux_ratio)


def main() -> None:
    output = Path(__file__).resolve().parents[1] / "data" / "projected_baseline.csv"
    rows = []
    for sample in range(73):
        hour = -6.0 + 12.0 * sample / 72.0
        u, v = project((1200.0, 0.0, 0.0), 0.21, hour, 25.0)
        measured = visibility(u, v)
        rows.append({"hour_angle_hours": hour, "u_wavelengths": u, "v_wavelengths": v, "visibility_real": measured.real, "visibility_imaginary": measured.imag})
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} reference visibility samples to {output}")


if __name__ == "__main__":
    main()
