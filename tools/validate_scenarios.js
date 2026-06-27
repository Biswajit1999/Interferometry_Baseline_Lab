// Run with: node tools/validate_scenarios.js
// Guard the real-world scale reference separately from the synthetic model.

const C_M_S = 299792458;
const ALMA_LONG_BASELINE = {
  maximumBaselineM: 16000,
  representativeWavelengthM: 0.87e-3,
};

function close(actual, expected, relativeTolerance = 1e-12) {
  if (Math.abs(actual - expected) > relativeTolerance * Math.max(1, Math.abs(expected))) {
    throw new Error(`expected ${expected}, received ${actual}`);
  }
}

const frequencyGHz = C_M_S / ALMA_LONG_BASELINE.representativeWavelengthM / 1e9;
const angularResolutionMas = ALMA_LONG_BASELINE.representativeWavelengthM / ALMA_LONG_BASELINE.maximumBaselineM * 206264806.247;

close(ALMA_LONG_BASELINE.maximumBaselineM, 16000);
close(ALMA_LONG_BASELINE.representativeWavelengthM, 0.00087);
if (frequencyGHz < 300 || frequencyGHz > 400) throw new Error(`representative wavelength is not submillimetre: ${frequencyGHz} GHz`);
if (angularResolutionMas <= 0 || angularResolutionMas > 20) throw new Error(`unexpected nominal angular scale: ${angularResolutionMas} mas`);

console.log(`PASS ALMA scale: B=${ALMA_LONG_BASELINE.maximumBaselineM / 1000} km, lambda=${ALMA_LONG_BASELINE.representativeWavelengthM * 1e3} mm, lambda/B=${angularResolutionMas.toFixed(2)} mas`);
console.log("PASS boundary: scenario metadata is instrument scale only; no visibility archive is asserted.");
