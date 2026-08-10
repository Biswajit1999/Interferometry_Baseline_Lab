# Synthesis Imaging Kernel Equations

For baseline vector `(Bx, By, Bz)`, source declination `delta`, hour angle `H` and wavelength
`lambda`, coordinates in wavelengths are:

```text
u = (Bx sin H + By cos H) / lambda
v = (-Bx sin delta cos H + By sin delta sin H + Bz cos delta) / lambda
```

The van Cittert-Zernike relationship is:

```text
V(u,v) = integral integral I(l,m) exp[-2 pi i(ul + vm)] dl dm
```

For the implemented two circular Gaussian sources with standard deviation `sigma`, displacement
`(l2,m2)` and relative flux `r`:

```text
V = exp[-2 pi^2 sigma^2(u^2+v^2)] [1+r exp(-2 pi i(ul2+vm2))] / (1+r)
```

The worker places each sample and conjugate on a centred natural-weighted Fourier grid:

```text
dirty beam  = IFFT2(weights)
dirty image = IFFT2(weights V)
```
