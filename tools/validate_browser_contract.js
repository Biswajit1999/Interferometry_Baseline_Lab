const RAD_TO_MAS = 206264806.247;

function rad(deg) {
  return deg * Math.PI / 180;
}

function projectedBaseline(baselineM, hourDeg, decDeg) {
  const hour = rad(hourDeg);
  const dec = rad(decDeg);
  const uM = baselineM * Math.sin(hour);
  const vM = -baselineM * Math.sin(dec) * Math.cos(hour);
  return Math.hypot(uM, vM);
}

function angularScaleMas(wavelengthUm, projectedM) {
  if (projectedM <= 0) throw new Error("projected baseline must be positive");
  return RAD_TO_MAS * wavelengthUm * 1e-6 / projectedM;
}

function binaryAmplitude(uLambda, vLambda, separationMas, positionAngleDeg, fluxRatio) {
  if (fluxRatio < 0) throw new Error("flux ratio must be non-negative");
  const separationRad = separationMas / RAD_TO_MAS;
  const pa = rad(positionAngleDeg);
  const dx = separationRad * Math.sin(pa);
  const dy = separationRad * Math.cos(pa);
  const phase = -2 * Math.PI * (uLambda * dx + vLambda * dy);
  const real = (1 + fluxRatio * Math.cos(phase)) / (1 + fluxRatio);
  const imag = (fluxRatio * Math.sin(phase)) / (1 + fluxRatio);
  return Math.hypot(real, imag);
}

function checkNear(name, value, expected, tolerance) {
  const passed = Math.abs(value - expected) <= tolerance;
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
  if (!passed) process.exitCode = 1;
}

function checkTrue(name, condition) {
  console.log(`${condition ? "PASS" : "FAIL"} ${name}`);
  if (!condition) process.exitCode = 1;
}

const b1 = projectedBaseline(120, 35, 20);
const b2 = projectedBaseline(240, 35, 20);
const s1 = angularScaleMas(1.65, b1);
const s2 = angularScaleMas(1.65, b2);
checkNear("baseline doubling halves angular scale", s2 / s1, 0.5, 1e-12);
checkNear("hour angle symmetry", projectedBaseline(120, 35, 20), projectedBaseline(120, -35, 20), 1e-12);
checkNear("zero declination transit projection", projectedBaseline(120, 0, 0), 0, 1e-12);
checkNear("radian to milliarcsecond constant", RAD_TO_MAS, 206264806.247, 1e-9);
const amp = binaryAmplitude(40e6, 12e6, 4, 35, 0.45);
const lower = Math.abs(1 - 0.45) / (1 + 0.45);
checkTrue("binary amplitude analytic bounds", lower <= amp && amp <= 1);
checkNear("unresolved source amplitude", binaryAmplitude(0, 0, 4, 35, 0.45), 1, 1e-12);
