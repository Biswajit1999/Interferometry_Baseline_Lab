# Scenario provenance and data boundary

## What is physically computed in the browser

The lab computes a narrow-field, two-element interferometer model from the current controls:

```text
u = B sin(H) / lambda
v = -B sin(delta) cos(H) / lambda
w = B cos(delta) cos(H) / lambda
```

The complex binary visibility, correlated fringe trace, Earth-rotation uv track, and natural-weighted response are all generated from those values at render time. They are not imported measurements.

## Scenario: ALMA 2021 high-frequency long-baseline scale

The `ALMA 2021 high-frequency long-baseline scale` preset uses:

```text
maximum baseline = 16 km
representative wavelength = 0.75 mm
```

Those values are a compact instrumental-scale reference to the ALMA high-frequency long-baseline campaign reported by Asaki et al. (2023), *ALMA High-frequency Long Baseline Campaign in 2021: Highest Angular Resolution Submillimeter Wave Images for the Carbon-rich Star R Lep*, arXiv:2310.09664. The paper describes observations in Bands 8--10 at 397--908 GHz, with baselines up to 16 km. The chosen 0.75 mm reference lies at the low-frequency edge of that high-frequency range.

The preset does **not** contain ALMA archive visibilities, a real ALMA antenna layout, calibrated phase solutions, or the sky coordinates of R Lep. It only provides a real-world scale for the browser's analytic two-element model.

## Interpretation boundary

- The `uv` line is a single east-west baseline track plus its Hermitian counterpart.
- The response map is an incomplete-sampling response, not a dirty image of an observed target.
- The binary source is synthetic in every scenario.
- Changing a slider converts the interface back to `Custom synthetic two-element experiment` so a scenario label can never be mistaken for the resulting settings being an unmodified observatory setup.
