# Validation Notes

## Checks Implemented

1. **Resolution scaling**

   Angular resolution must improve linearly with increasing projected baseline and degrade linearly with increasing wavelength.

2. **uv symmetry**

   For the simplified east-west baseline, hour angles of opposite sign should produce symmetric `u` coordinates and identical projected baseline magnitude.

3. **Declination dependence**

   At transit (`H = 0`), the projected baseline for this simplified east-west geometry is controlled by `|sin(delta)|`.

4. **Unit conversion**

   The conversion from radians to milliarcseconds uses:

   ```text
   1 rad = 206264806.247 mas
   ```

5. **Binary visibility bounds**

   The normalised two-point-source visibility amplitude should remain in the interval:

   ```text
   |1 - r| / (1 + r) <= |V| <= 1
   ```

## Scientific Scope

This validates the geometry of a one-baseline teaching model and a simple two-point-source visibility equation. It does not validate full synthesis imaging, calibration, atmospheric phase errors, array layout optimisation, or reconstructed sky brightness.
