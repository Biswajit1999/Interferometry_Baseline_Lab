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
