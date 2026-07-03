# Interferometry Baseline Lab

Interactive synthesis-interferometry laboratory for ENU array geometry, projected baselines, Earth-rotation uvw coverage, complex binary visibility, and the response from incomplete Fourier sampling.

**Author:** Biswajit Jana

## Purpose

The laboratory makes the source-projected nature of angular resolution explicit. A fixed ground array samples different Fourier coordinates as the source hour angle changes. It is an educational, narrow-field model, not a calibrated imaging pipeline.

## Array model

Choose among three idealised local ENU layouts:

- two-collector east-west pair;
- three-collector L layout;
- four-collector Y layout.

They are synthetic teaching geometries, not reproductions of an observatory configuration. For an antenna-pair vector `(B_E, B_N, B_U)`, hour angle `H`, declination `delta`, and wavelength `lambda`, the code uses

```text
u = [B_E sin(H) + B_N cos(H)] / lambda
v = [-B_E sin(delta) cos(H) + B_N sin(delta) sin(H) + B_U cos(delta)] / lambda
w = [B_E cos(delta) cos(H) - B_N cos(delta) sin(H) + B_U sin(delta)] / lambda
```

Every pair contributes an Earth-rotation track and Hermitian counterpart to the coverage display. The pair with the largest projected baseline supplies the single fringe and binary-visibility readout.

For a binary source with flux ratio `r` and angular separation vector `(dx, dy)`, the complex visibility is

```text
V(u, v) = [1 + r exp(-2 pi i (u dx + v dy))] / (1 + r)
```

The sampling-response panel is a naturally weighted real Fourier sum over all selected tracks. It is an instrumental response function, not a reconstructed sky image. The response assumptions and limits are documented in [`docs/sampling_response_validation.md`](docs/sampling_response_validation.md).

## Features

- Idealised two, three, and four-collector array presets.
- Local east-north array-layout diagram.
- ENU to uvw projection for every baseline pair.
- Adjustable hour-angle synthesis span.
- uv coverage and Hermitian counterparts.
- Projected resolution, spatial frequency, complex binary visibility, and phase.
- Correlated fringe signal from the selected longest projected baseline.
- Natural-weighted sampling response from all selected tracks.
- Clearly labelled synthetic ALMA-scale scenario.

## Run and validate

Open `index.html` in a modern browser.

```bash
python tools/projected_baseline_table.py
python tools/validate_model.py
node tools/validate_browser_contract.js
node tools/validate_arrays.js
node tools/validate_sampling_response.js
```

The checks verify ENU projection limits, array pair counts, baseline scaling, binary-visibility bounds, and sampling-response Hermitian symmetry.

## Model boundaries

- No primary beam, thermal noise, calibration/gain errors, atmospheric phase error, delay tracking, gridding kernel, bandwidth synthesis, or deconvolution.
- The response panel is not a dirty image or a CLEAN reconstruction.
- The `w` coordinate is calculated and reported but no wide-field `w` correction is applied.
- The binary source and all layouts are synthetic.
- The ALMA scale preset is a documented scale comparison only; it is not an ALMA archive-data client.

## References

- Thompson, Moran and Swenson, Interferometry and Synthesis in Radio Astronomy.
- Monnier, 2003, Optical interferometry in astronomy.
- Taylor, Carilli and Perley, Synthesis Imaging in Radio Astronomy II.

## Topics

`interferometry`, `radio-astronomy`, `instrumentation`, `uv-coverage`, `angular-resolution`, `scientific-visualisation`, `javascript`
