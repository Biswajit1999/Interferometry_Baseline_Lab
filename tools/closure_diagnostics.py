"""Descriptive closure observables and uv sampling diagnostics for EHT CSV releases.

Closure quantities are station-gain invariant in the ideal model, but these
functions do not calibrate the EHT data or infer source morphology.
"""
from __future__ import annotations

import csv
from dataclasses import dataclass
from itertools import combinations
import math
from pathlib import Path
from collections import defaultdict

RAD_TO_UAS = 180 / math.pi * 3600 * 1e6


@dataclass(frozen=True)
class Visibility:
    utc_hour: float
    station1: str
    station2: str
    u_lambda: float
    v_lambda: float
    amplitude_jy: float
    phase_deg: float
    sigma_jy: float

    def __post_init__(self) -> None:
        numbers = (self.utc_hour, self.u_lambda, self.v_lambda,
                   self.amplitude_jy, self.phase_deg, self.sigma_jy)
        if (not all(math.isfinite(x) for x in numbers)
                or self.amplitude_jy <= 0 or self.sigma_jy <= 0
                or self.station1 == self.station2):
            raise ValueError("invalid visibility or uncertainty")

    @property
    def complex_jy(self) -> complex:
        angle = math.radians(self.phase_deg)
        return self.amplitude_jy * complex(math.cos(angle), math.sin(angle))


def read_visibilities(path: Path) -> list[Visibility]:
    """Read official EHT Stokes-I CSV with metadata comment lines."""
    with path.open(encoding="utf-8", newline="") as handle:
        records = []
        for row in csv.reader(handle):
            if not row or row[0].lstrip().startswith("#"):
                continue
            if len(row) != 8:
                raise ValueError(f"expected eight EHT CSV columns in {path}")
            records.append(Visibility(float(row[0]), row[1].strip(), row[2].strip(),
                                      *map(float, row[3:])))
    if not records:
        raise ValueError("empty EHT visibility product")
    return records


def _per_time(rows: list[Visibility]):
    """At repeated baseline/time entries, retain the lowest fractional error."""
    grouped = defaultdict(dict)
    for row in rows:
        pair = frozenset((row.station1, row.station2))
        current = grouped[row.utc_hour].get(pair)
        if current is None or row.sigma_jy / row.amplitude_jy < current.sigma_jy / current.amplitude_jy:
            grouped[row.utc_hour][pair] = row
    return grouped


def _oriented(group: dict, a: str, b: str) -> complex | None:
    row = group.get(frozenset((a, b)))
    if row is None:
        return None
    return row.complex_jy if (row.station1, row.station2) == (a, b) else row.complex_jy.conjugate()


def _row(group: dict, a: str, b: str) -> Visibility | None:
    return group.get(frozenset((a, b)))


def _station_names(group: dict) -> list[str]:
    return sorted({station for pair in group for station in pair})


def closure_phases(rows: list[Visibility], min_snr: float = 3) -> list[dict]:
    """Triangle bispectrum phases and first-order high-SNR thermal uncertainties.

    V_ab V_bc V_ca cancels antenna-based phases. Missing simultaneous
    baselines and SNR-below-threshold triangles are skipped.
    """
    if min_snr <= 0:
        raise ValueError("min_snr must be positive")
    output = []
    for time, group in _per_time(rows).items():
        for a, b, c in combinations(_station_names(group), 3):
            pairs = ((a, b), (b, c), (c, a))
            selected = [_row(group, x, y) for x, y in pairs]
            if any(r is None or r.amplitude_jy / r.sigma_jy < min_snr for r in selected):
                continue
            bispectrum = 1 + 0j
            for x, y in pairs:
                bispectrum *= _oriented(group, x, y)
            output.append({"utc_hour": time, "stations": f"{a}-{b}-{c}",
                           "closure_phase_deg": math.degrees(math.atan2(bispectrum.imag, bispectrum.real)),
                           "thermal_sigma_deg": math.degrees(math.sqrt(sum(
                               (r.sigma_jy / r.amplitude_jy)**2 for r in selected)))})
    return output


def closure_amplitudes(rows: list[Visibility], min_snr: float = 3) -> list[dict]:
    """Log closure amplitude for each four-station set: ln(|Vab Vcd/Vac Vbd|).

    Thermal uncertainty is first-order; low-SNR Rice bias and correlations
    are not corrected. Only one of three possible quadrangle ratios is used.
    """
    if min_snr <= 0:
        raise ValueError("min_snr must be positive")
    output = []
    for time, group in _per_time(rows).items():
        for a, b, c, d in combinations(_station_names(group), 4):
            pairs = ((a, b), (c, d), (a, c), (b, d))
            selected = [_row(group, x, y) for x, y in pairs]
            if any(r is None or r.amplitude_jy / r.sigma_jy < min_snr for r in selected):
                continue
            log_amp = (math.log(selected[0].amplitude_jy) + math.log(selected[1].amplitude_jy)
                       - math.log(selected[2].amplitude_jy) - math.log(selected[3].amplitude_jy))
            output.append({"utc_hour": time, "stations": f"{a}-{b}-{c}-{d}",
                           "log_closure_amplitude": log_amp,
                           "thermal_sigma_log": math.sqrt(sum(
                               (r.sigma_jy / r.amplitude_jy)**2 for r in selected))})
    return output


def uv_sampling_moments(rows: list[Visibility], inverse_variance: bool = False) -> dict:
    """Second moments of Hermitian-symmetric uv sampling (not a fitted beam)."""
    if not rows:
        raise ValueError("need at least one visibility")
    total = uu = uv = vv = 0.0
    for row in rows:
        weight = 1 / row.sigma_jy**2 if inverse_variance else 1.0
        total += weight
        uu += weight * row.u_lambda**2
        uv += weight * row.u_lambda * row.v_lambda
        vv += weight * row.v_lambda**2
    uu, uv, vv = uu / total, uv / total, vv / total
    trace = uu + vv
    gap = math.hypot(uu - vv, 2 * uv)
    high = max(0.0, (trace + gap) / 2)
    low = max(0.0, (trace - gap) / 2)
    # Scale is 1/(2 pi sigma_uv), not a synthesized-beam FWHM.
    return {"count": len(rows), "weighted": inverse_variance,
            "eigenvalues_lambda_squared": [high, low],
            "uv_axis_ratio": math.sqrt(high / low) if low > 0 else math.inf,
            "angular_scale_proxy_uas": [RAD_TO_UAS / (2 * math.pi * math.sqrt(x))
                                        if x > 0 else math.inf for x in (high, low)]}


def leave_one_hour_out_uv(rows: list[Visibility]) -> list[dict]:
    """Sensitivity of the uv sampling anisotropy to removing each UTC hour."""
    groups = {math.floor(row.utc_hour) for row in rows}
    if len(groups) < 2:
        raise ValueError("need at least two populated UTC-hour groups")
    output = []
    for hour in sorted(groups):
        retained = [row for row in rows if math.floor(row.utc_hour) != hour]
        if not retained:
            continue
        result = uv_sampling_moments(retained)
        output.append({"excluded_utc_hour": hour, "retained": len(retained),
                       "uv_axis_ratio": result["uv_axis_ratio"]})
    return output
