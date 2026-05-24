# Interferometry Baseline Lab

Interactive laboratory for angular resolution, projected baselines, fringe spacing, and uv coverage intuition.

**Author:** Biswajit Jana

## Research Motivation

Interferometry converts separated telescopes or antennas into a synthetic aperture. The resolving power depends on wavelength and projected baseline, while Earth rotation changes the sampled uv plane. This project provides a compact visual tool for understanding those relationships.

## Model

The nominal interferometric fringe spacing is:

```text
theta ~= lambda / B_projected
```

where `lambda` is observing wavelength and `B_projected` is the source-projected baseline. The simulator uses a simplified projected baseline:

```text
u = B sin(H) / lambda
v = -B sin(delta) cos(H) / lambda
B_projected = lambda sqrt(u^2 + v^2)
```

where `H` is hour angle and `delta` is declination.

## Features

- Baseline, wavelength, source separation, hour angle, and declination controls.
- Angular resolution and fringe spacing readouts.
- Fringe pattern sketch.
- uv coverage sketch with current projected sample.

## Research Use Cases

- Teaching how projected baseline, observing wavelength, and source geometry control interferometric resolution.
- Prototyping uv-track visualisations before adding real array configurations.
- Generating synthetic baseline tables for plotting and dashboard experiments.
- Building intuition for optical or radio interferometry before introducing calibrated complex visibilities.

## Running Locally

Open `index.html` in a browser.

Optional Python table generation and validation:

```bash
python tools/projected_baseline_table.py
python tools/validate_model.py
```

## README Image Prompt

A README hero image prompt is provided in [`docs/image_prompt.md`](docs/image_prompt.md). It focuses on baseline geometry, uv coverage, and interference fringes for a research-style banner.

## Limitations

This first version is a geometric teaching model. It does not include full array geometry, antenna primary beams, visibility amplitudes, atmospheric phase noise, calibration errors, bandwidth smearing, or image reconstruction.

## Research References

- Thompson, Moran & Swenson, *Interferometry and Synthesis in Radio Astronomy*.
- Monnier, 2003, *Optical interferometry in astronomy*.
- Taylor, Carilli & Perley, 1999, *Synthesis Imaging in Radio Astronomy II*.
- van Cittert-Zernike theorem literature connecting sky brightness and complex visibility.

## Future Upgrades

- Add multiple baselines and real array presets.
- Add visibility amplitude for binary sources.
- Add Fourier-plane sampling and dirty beam visualisation.
- Add Python notebook for uv-track generation.
- Add CHARA, VLTI, ALMA, and VLA-inspired educational presets with citations.

## Topics

`interferometry`, `radio-astronomy`, `instrumentation`, `uv-coverage`, `angular-resolution`, `scientific-visualisation`, `javascript`
