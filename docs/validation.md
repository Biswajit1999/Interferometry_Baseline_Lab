# Validation Protocol

Run:

```bash
python tools/projected_baseline_table.py
python tools/validate_model.py
```

Checks verify the required `u` projection formula, Hermitian conjugate visibility symmetry,
normalisation `V(0,0)=1`, reduced long-baseline amplitude for a resolved Gaussian, and improved
nominal beam scale as maximum spatial frequency increases. The browser worker additionally
executes full progressive gridding and 2D inverse FFT generation. This is internal consistency
validation and excludes calibration, wide-field corrections and deconvolution.
