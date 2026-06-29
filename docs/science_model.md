# Interferometry Science Model

This project is a pedagogical two-element interferometry visualisation. It is not a full aperture-synthesis, calibration, or image-reconstruction package.

## Projected baseline

The model uses a simplified projected baseline for a single east-west style baseline:

```text
u = B sin(H) / lambda
v = -B sin(delta) cos(H) / lambda
B_projected = lambda sqrt(u^2 + v^2)
```

Here `B` is the physical baseline, `H` is hour angle, `delta` is source declination, and `lambda` is wavelength.

## Angular scale

The nominal angular scale is:

```text
theta = lambda / B_projected
```

The browser reports this in milliarcseconds using:

```text
1 rad = 206264806.247 mas
```

This is a fringe-spacing or nominal resolution scale, not a guaranteed image-reconstruction resolution.

## Binary-source visibility

For a two-point-source model with separation vector `(dx, dy)` and flux ratio `r`, the complex visibility is:

```text
V = [1 + r exp(-i 2 pi (u dx + v dy))] / (1 + r)
```

The amplitude should stay within:

```text
abs(1 - r) / (1 + r) <= |V| <= 1
```

## Visualisation limits

The fringe panel is a qualitative phase sketch. The uv panel shows a single-baseline track for the simplified geometry. Neither panel is a dirty image, a synthesized beam, a calibrated visibility product, or a full array simulator.

## Validation contract

The repository should validate:

1. Doubling the baseline halves the angular scale for fixed geometry and wavelength.
2. Positive and negative hour angles have symmetric projected-baseline lengths in this simplified model.
3. Zero declination at transit gives zero projected baseline for this chosen east-west-style geometry.
4. The radian-to-milliarcsecond conversion constant is stable.
5. Binary-source visibility amplitude remains within analytic bounds.

## Next physical upgrade

The next defensible upgrade is a dirty-beam module using sampled uv points and the inverse Fourier transform of the sampling function. That should be added only with tests for Hermitian uv symmetry, beam peak normalisation, and angular-axis units.
