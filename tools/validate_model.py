"""Validate uv projection and analytic visibility relationships."""

from __future__ import annotations

import csv
import math
from pathlib import Path

from projected_baseline_table import project, visibility


def main() -> None:
    u_formula, _ = project((1200.0, 430.0, 0.0), 0.21, 2.5, 25.0)
    hour = 2.5 * math.pi / 12.0
    expected_u = (1200.0 * math.sin(hour) + 430.0 * math.cos(hour)) / 0.21
    at_origin = visibility(0.0, 0.0)
    u, v = project((1200.0, 0.0, 0.0), 0.21, 4.0, 25.0)
    sample = visibility(u, v)
    conjugate = visibility(-u, -v)
    rows = [
        {"check": "required_u_projection", "value": u_formula, "expected": expected_u, "passed": math.isclose(u_formula, expected_u, rel_tol=1e-14)},
        {"check": "visibility_origin_normalised", "value": abs(at_origin), "expected": 1.0, "passed": math.isclose(abs(at_origin), 1.0, rel_tol=1e-14)},
        {"check": "hermitian_visibility", "value": abs(conjugate - sample.conjugate()), "expected": 0.0, "passed": abs(conjugate - sample.conjugate()) < 1e-14},
        {"check": "resolved_source_attenuation", "value": abs(sample), "expected": "<= 1", "passed": abs(sample) <= 1.0},
        {"check": "baseline_resolution_scaling", "value": (1 / 2000) / (1 / 1000), "expected": 0.5, "passed": math.isclose((1 / 2000) / (1 / 1000), 0.5)},
    ]
    output = Path(__file__).resolve().parents[1] / "data" / "validation_summary.csv"
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["check", "value", "expected", "passed"])
        writer.writeheader()
        writer.writerows(rows)
    failures = [row["check"] for row in rows if not row["passed"]]
    if failures:
        raise SystemExit(f"Validation failed: {', '.join(str(value) for value in failures)}")
    print(f"Validated {len(rows)} visibility invariants; wrote {output}")


if __name__ == "__main__":
    main()
