# Visibility-space numerical diagnostics

Run from tools: `python -m unittest -v test_visibility_diagnostics.py`.

This standalone module computes oriented-triangle closure phase, its high-SNR independent-complex-noise approximation, radial uv coverage, and Hermitian-conjugacy discrepancies for explicitly paired samples. Closure phase cancels station-based phase factors only when the three baselines form a consistent simultaneous triangle. Released EHT time-averaged Stokes-I CSV rows cannot automatically be treated as simultaneous closure triangles. The reported visibility-amplitude errors are not automatically the per-Cartesian-component noise required by the uncertainty approximation. No observational closure phase or M87 image reconstruction is claimed.

Synthetic unit tests verify algebra, station-phase cancellation and edge cases. No calibrated EHT data inference has been performed. AI-assisted implementation and tests are disclosed for review.
