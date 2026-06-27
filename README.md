# Interferometry Baseline Lab

Interactive two-element interferometry laboratory for angular resolution, projected east-west baselines, Earth-rotation `u,v,w` tracks, complex binary visibility, incomplete Fourier sampling, and clearly labelled instrument-scale scenarios.

**Author:** Biswajit Jana

## Research Motivation

Interferometry turns separated collectors into a synthetic aperture. The angular scale depends on wavelength and the **source-projected** baseline, while Earth rotation changes the Fourier coordinates sampled by a fixed ground baseline. This laboratory makes that connection explicit for a narrow-field, two-element teaching model.

## Model

The nominal fringe spacing is

```text
theta ~= lambda / B_projected
```

The browser model uses one horizontal east-west baseline. For hour angle `H`, declination `delta`, and wavelength `lambda`, its source-frame coordinates are

```text
u = B sin(H) / lambda
v = -B sin(delta) cos(H) / lambda
w = B cos(delta) cos(H) / lambda
```

The `uv` panel draws the Earth-rotation track from `-6 h` to `+6 h` and its Hermitian-conjugate counterpart. For a binary with flux ratio `r` and separation `(dx, dy)`, the complex visibility is

```text
V(u, v) = [1 + r exp(-2 pi i (u dx + v dy))] / (1 + r)
```

The response map is a direct natural-weighted Fourier sum of the sampled track. It is a view of the instrument response to incomplete coverage, not a calibrated dirty image, CLEAN reconstruction, or sky measurement.

## Provenance-aware scenario

The interface includes an `ALMA 2021 long-baseline scale` scenario. It sets a `16 km` baseline and `0.87 mm` representative wavelength from a documented ALMA long-baseline campaign. It does **not** load a real ALMA antenna layout, a calibrated ALMA measurement set, archived visibilities, or R Lep coordinates. The source and every plotted visibility remain synthetic.

Changing any slider automatically returns to `Custom synthetic two-element experiment`, preventing the preset label from being mistaken for an unmodified observatory setup. See [`docs/provenance.md`](docs/provenance.md) for the model/data boundary and bibliographic source.

## Features

- Horizontal east-west baseline, wavelength, source separation, hour-angle, and declination controls.
- Custom synthetic and ALMA-scale scenario selection with an on-page provenance banner.
- Projected baseline, spatial frequency, complex visibility amplitude, and phase readouts.
- Earth-rotation `uv` track plus the Hermitian-conjugate coverage.
- Correlated fringe signal generated from the binary complex visibility.
- Binary visibility curve versus baseline scale.
- Natural-weighted sampling response derived from the same track.
- Deterministic `u,v,w` limit check in `tools/validate_uvw.js`.
- Deterministic scenario metadata check in `tools/validate_scenarios.js`.

## Running Locally

Open `index.html` in a modern browser.

Run the analytic convention checks with:

```bash
node tools/validate_uvw.js
node tools/validate_scenarios.js
```

## Limitations

This is an educational two-element, narrow-field model.

- The ground baseline is fixed to horizontal east-west orientation; it does not yet include real multi-antenna array layouts.
- The ALMA-scale scenario is an instrument-scale reference, not real interferometric data.
- The sampling response has no primary beam, visibility weighting options, noise, calibration errors, gridding kernel, bandwidth synthesis, or deconvolution.
- The `w` coordinate is reported but a wide-field measurement equation and `w`-projection are not implemented.
- It does not model atmospheric phase noise, delay tracking, closure quantities, or observatory-specific metadata.

## Research References

- Thompson, Moran & Swenson, *Interferometry and Synthesis in Radio Astronomy*.
- Monnier, 2003, *Optical interferometry in astronomy*.
- Taylor, Carilli & Perley, 1999, *Synthesis Imaging in Radio Astronomy II*.
- Asaki et al., 2023, *ALMA High-frequency Long Baseline Campaign in 2021: Highest Angular Resolution Submillimeter Wave Images for the Carbon-rich Star R Lep*, arXiv:2310.09664.
- van Cittert-Zernike theorem literature connecting sky brightness and complex visibility.

## Future Upgrades

- Add arbitrary ENU baseline vectors and real-array layout files with a separate data licence/provenance record.
- Add a small-field versus wide-field `w`-term comparison.
- Add primary beams, calibration/noise models, and multi-frequency tracks.
- Add a separately labelled toy deconvolution after a gridded response image exists.
- Cross-check sampled visibilities against a Python Fourier reference.

## Topics

`interferometry`, `radio-astronomy`, `instrumentation`, `uv-coverage`, `angular-resolution`, `scientific-visualisation`, `javascript`
