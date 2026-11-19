"""Plot April 5 M87 high-band coverage and visibility-amplitude summaries."""

import csv
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np


def main():
    root = Path(__file__).resolve().parents[1]
    source = root / "data/observations/SR1_M87_2017_095_hi_hops_netcal_StokesI.csv"
    with source.open(newline="", encoding="utf-8") as stream:
        next(stream)
        rows = list(csv.DictReader(stream))
    u = np.array([float(row["U(lambda)"]) for row in rows]) / 1e9
    v = np.array([float(row["V(lambda)"]) for row in rows]) / 1e9
    amplitude = np.array([float(row["Iamp(Jy)"]) for row in rows])
    sigma = np.array([float(row["Isigma(Jy)"]) for row in rows])
    baseline = np.hypot(u, v)
    edges = np.arange(0, np.floor(baseline.max() * 2) / 2 + 1, 0.5)
    binned = []
    for lower, upper in zip(edges[:-1], edges[1:]):
        keep = (baseline >= lower) & (baseline < upper)
        if np.any(keep):
            p16, median, p84 = np.percentile(amplitude[keep], [16, 50, 84])
            binned.append([lower, upper, int(keep.sum()), np.median(baseline[keep]),
                           median, p16, p84, np.median(sigma[keep])])
    fields = ["baseline_min_glambda", "baseline_max_glambda", "sample_count",
              "median_baseline_glambda", "median_amplitude_jy", "p16_amplitude_jy",
              "p84_amplitude_jy", "median_released_sigma_jy"]
    table = root / "data/m87-april05-high-baseline-summary.csv"
    with table.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.writer(stream, lineterminator="\n")
        writer.writerow(fields)
        writer.writerows(binned)
    sample = np.asarray(binned)
    with plt.rc_context({"font.size": 10, "axes.spines.top": False, "axes.spines.right": False}):
        fig, (uv, profile) = plt.subplots(1, 2, figsize=(9.4, 4.6), layout="constrained")
        fig.suptitle("M87* · EHT high band · 5 April 2017", x=0.01, ha="left", fontweight="bold")
        uv.scatter(u, v, s=3, color="#24586c", alpha=0.24, linewidths=0)
        uv.set(xlabel="u (Gλ)", ylabel="v (Gλ)", title=f"Released coverage ({len(rows):,} rows)")
        uv.set_aspect("equal")
        profile.errorbar(
            sample[:, 3], sample[:, 4], yerr=[sample[:, 4]-sample[:, 5], sample[:, 6]-sample[:, 4]],
            fmt="o", color="#24586c", lw=1.1, capsize=3, ms=4, label="Median and 16th–84th percentiles",
        )
        profile.set(xlabel="Projected baseline (Gλ)", ylabel="Stokes-I amplitude (Jy)",
                    title="Visibility amplitude in 0.5 Gλ bins")
        profile.legend(frameon=False, loc="upper right", fontsize=8)
        for axis in (uv, profile):
            axis.grid(True, color="#e0e4e8", lw=0.7)
            axis.set_axisbelow(True)
        fig.savefig(root / "assets/m87-april05-high-baselines.png", dpi=110)
        plt.close(fig)


if __name__ == "__main__":
    main()
