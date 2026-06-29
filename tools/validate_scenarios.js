// Run with: node tools/validate_scenarios.js
// Guard the real-world scale reference separately from the synthetic model.

const C_M_S = 299792458;
const ALMA_HIGH_FREQUENCY_SCALE = {
  maximumBaselineM: 16000,
  representativeWavelengthM: 0.75e-3,
};

function close(actual, expected, relativeTolerance = 1e-12) {
  if (Math.abs(actual - expected) > relativeTolerance * Math.max(1, Math.abs(expected))) {
    throw new Error(`expected ${expected}, received ${actual}`);
  }
}

const frequencyGHz = C_M_S / ALMA_HIGH_FREQUENCY_SCALE.representativeWavelengthM / 1e9;
const angularResolutionMas = ALMA_HIGH_FREQUENCY_SCALE.representativeWavelengthM / ALMA_HIGH_FREQUENCY_SCALE.maximumBaselineM * 206264806.247;

close(ALMA_HIGH_FREQUENCY_SCALE.maximumBaselineM, 16000);
close(ALMA_HIGH_FREQUENCY_SCALE.representativeWavelengthM, 0.00075);
if (frequencyGHz < 397 || frequencyGHz > 908) throw new Error(`reference frequency lies outside the documented high-frequency campaign span: ${frequencyGHz} GHz`);
if (angularResolutionMas <= 0 || angularResolutionMas > 20) throw new Error(`unexpected nominal angular scale: ${angularResolutionMas} mas`);

console.log(`PASS ALMA high-frequency scale: B=${ALMA_HIGH_FREQUENCY_SCALE.maximumBaselineM / 1000} km, lambda=${ALMA_HIGH_FREQUENCY_SCALE.representativeWavelengthM * 1e3} mm, frequency=${frequencyGHz.toFixed(1)} GHz, lambda/B=${angularResolutionMas.toFixed(2)} mas`);
console.log("PASS boundary: scenario metadata is instrument scale only; no visibility archive is asserted.");
