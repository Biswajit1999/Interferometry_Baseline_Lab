# Equations and Assumptions

## Angular Resolution

The interferometric fringe spacing is approximated by:

```text
theta ~= lambda / B_projected
```

where `lambda` is wavelength and `B_projected` is the baseline component perpendicular to the source direction.

## East-West Baseline uv Track

For a simplified east-west baseline, the projected coordinates are:

```text
u = B sin(H) / lambda
v = -B sin(delta) cos(H) / lambda
```

where `H` is hour angle and `delta` is source declination. The projected baseline length is:

```text
B_projected = lambda sqrt(u^2 + v^2)
```

Equivalently, substituting the expressions above:

```text
B_projected = B sqrt[sin^2(H) + sin^2(delta) cos^2(H)]
```

## Binary-Source Fringe Sketch

The displayed fringe phase uses a simplified phase offset proportional to:

```text
phase offset proportional to separation / theta
```

This shows qualitative fringe sensitivity to angular separation, not calibrated visibility fitting.

## Binary Complex Visibility

For a two-point-source model with flux ratio `r = F2 / F1`, the normalised complex visibility is:

```text
V(u, v) = [1 + r exp(-2 pi i (u dx + v dy))] / (1 + r)
```

where `(dx, dy)` is the angular separation vector on the sky in radians. The browser reports:

```text
|V| = sqrt(Re(V)^2 + Im(V)^2)
phase = atan2(Im(V), Re(V))
```
