"""Independent visibility-space diagnostics, not EHT imaging or calibration."""
from __future__ import annotations
import cmath
import math


def closure_phase_deg(v_ab, v_bc, v_ca):
    """Bispectrum phase for oriented baselines AB, BC, CA, in degrees."""
    if not all(math.isfinite(z.real) and math.isfinite(z.imag) for z in (v_ab, v_bc, v_ca)):
        raise ValueError('Visibilities must be finite')
    product = v_ab * v_bc * v_ca
    if abs(product) == 0 or not math.isfinite(abs(product)):
        raise ValueError('Degenerate bispectrum')
    return math.degrees(cmath.phase(product))


def closure_phase_sigma_deg(amplitudes, sigma_amplitudes):
    """Small-noise phase-error approximation, independent circular complex noise.

    Each sigma is the standard deviation of either Cartesian complex component.
    Not valid at low S/N or for correlated station/systematic errors.
    """
    if len(amplitudes) != 3 or len(sigma_amplitudes) != 3:
        raise ValueError('Three baseline amplitudes and errors required')
    if any(not math.isfinite(a) or a <= 0 for a in amplitudes) or any(not math.isfinite(s) or s < 0 for s in sigma_amplitudes):
        raise ValueError('Invalid amplitudes or errors')
    return math.degrees(math.sqrt(math.fsum((s/a)**2 for a,s in zip(amplitudes,sigma_amplitudes))))


def radial_uv_coverage(u, v, bins):
    """Count measured visibility samples in half-open radial uv bins (wavelengths)."""
    if len(u) != len(v) or len(bins) < 2 or any(not math.isfinite(x) for x in (*u,*v,*bins)):
        raise ValueError('Invalid coordinates or bin edges')
    if bins[0] < 0 or any(b <= a for a,b in zip(bins,bins[1:])):
        raise ValueError('Bin edges must increase from nonnegative radius')
    counts = [0] * (len(bins)-1)
    outside = 0
    for x,y in zip(u,v):
        r = math.hypot(x,y)
        found = False
        for j,(lo,hi) in enumerate(zip(bins,bins[1:])):
            if lo <= r < hi:
                counts[j] += 1
                found = True
                break
        if not found: outside += 1
    return {'counts': counts, 'outside': outside, 'total': len(u)}


def hermitian_residual(v_uv, v_minus_uv):
    """Absolute conjugacy discrepancy; meaningful only for paired measurements."""
    if not all(math.isfinite(z.real) and math.isfinite(z.imag) for z in (v_uv,v_minus_uv)):
        raise ValueError('Nonfinite visibility')
    return abs(v_uv - v_minus_uv.conjugate())
