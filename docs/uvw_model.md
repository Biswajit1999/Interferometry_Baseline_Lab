# UVW model

The browser currently models one horizontal east-west baseline. For wavelength `lambda`, hour angle `H`, and declination `delta`, it uses:

```text
u = B sin(H) / lambda
v = -B sin(delta) cos(H) / lambda
w = B cos(delta) cos(H) / lambda
```

The coverage panel shows the Earth-rotation track from `-6 h` to `+6 h`, plus its Hermitian-conjugate counterpart. The response panel is a naturally weighted inverse-Fourier sum of the displayed samples. It is not a calibrated image reconstruction and does not include a primary beam, calibration errors, thermal noise, a wide-field `w` correction, or deconvolution.
