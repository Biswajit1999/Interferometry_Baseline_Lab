# Sampling Response Validation

The sampling-response panel is a teaching visualisation of the Fourier response from sampled uv points. It is not a reconstructed sky image, CLEAN image, calibrated observation, or full dirty image.

## Contract

The response is defined from sampled uv coordinates `(u, v)` and sky-direction offsets `(l, m)` as

```text
R(l, m) = (1 / N) sum_k exp[2 pi i (u_k l + v_k m)]
```

The displayed browser panel currently plots a real cosine sum. That is physically defensible only when the sampled coordinates include the Hermitian counterpart `(-u, -v)` for every point `(u, v)`.

With Hermitian sampling, the imaginary part cancels and the response is real:

```text
R(l, m) = R(-l, -m)
Im[R(l, m)] = 0
R(0, 0) = 1
|R(l, m)| <= 1
```

## Validation added

`tools/validate_sampling_response.js` checks:

1. central peak normalisation at `(l, m) = (0, 0)`;
2. imaginary cancellation for Hermitian uv sampling;
3. even symmetry of the real response under `(l, m) -> (-l, -m)`;
4. the normalised response bound `|R| <= 1`;
5. that a non-Hermitian sample can carry an imaginary component, so the Hermitian assumption is not being tested trivially.

## Boundary of the current model

The current panel does not include gridding kernels, visibility weights, primary beam attenuation, thermal noise, calibration errors, phase screens, bandwidth smearing, or deconvolution. It should therefore remain labelled as a sampling response rather than a final astronomical image.

## Next scientific upgrade

The next step is to turn the response into an explicit dirty-beam module with selectable weighting. That upgrade should add tests for:

- natural versus uniform weighting;
- beam peak normalisation after weighting;
- sidelobe-level reporting;
- angular-axis units in milliarcseconds;
- Hermitian uv-pair preservation after any downsampling or filtering.
