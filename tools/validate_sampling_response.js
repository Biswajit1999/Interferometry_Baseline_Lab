// Run with: node tools/validate_sampling_response.js

const RAD_TO_MAS = 206264806.247;

function close(name, actual, expected, tolerance = 1e-12) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${name}: expected ${expected}, received ${actual}`);
  }
}

function assert(name, condition) {
  if (!condition) throw new Error(name);
}

function rad(deg) {
  return deg * Math.PI / 180;
}

function uvwMeters(pair, hour, dec) {
  return {
    u: pair.east * Math.sin(hour) + pair.north * Math.cos(hour),
    v: -pair.east * Math.sin(dec) * Math.cos(hour) + pair.north * Math.sin(dec) * Math.sin(hour) + pair.up * Math.cos(dec),
    w: pair.east * Math.cos(dec) * Math.cos(hour) - pair.north * Math.cos(dec) * Math.sin(hour) + pair.up * Math.sin(dec),
  };
}

function sampleTrack(pair, dec, wavelengthM, trackHours) {
  const points = [];
  const samples = 181;
  const halfAngle = rad(trackHours * 15);
  for (let i = 0; i < samples; i += 1) {
    const hour = -halfAngle + (2 * halfAngle * i) / (samples - 1);
    const uvw = uvwMeters(pair, hour, dec);
    points.push({ u: uvw.u / wavelengthM, v: uvw.v / wavelengthM });
  }
  return points;
}

function withHermitian(points) {
  return points.flatMap((point) => [point, { u: -point.u, v: -point.v }]);
}

function response(points, l, m) {
  let real = 0;
  let imag = 0;
  for (const point of points) {
    const phase = 2 * Math.PI * (point.u * l + point.v * m);
    real += Math.cos(phase);
    imag += Math.sin(phase);
  }
  return { real: real / points.length, imag: imag / points.length };
}

const pair = { east: 120, north: 0, up: 0 };
const wavelengthM = 1.65e-6;
const dec = rad(20);
const samples = withHermitian(sampleTrack(pair, dec, wavelengthM, 6));

const centre = response(samples, 0, 0);
close("central response real peak", centre.real, 1);
close("central response imaginary cancellation", centre.imag, 0);

const l = 1.7 / RAD_TO_MAS;
const m = -0.9 / RAD_TO_MAS;
const forward = response(samples, l, m);
const reverse = response(samples, -l, -m);
close("Hermitian response even real part", forward.real, reverse.real, 1e-12);
close("Hermitian response odd imaginary part", forward.imag, -reverse.imag, 1e-12);
close("Hermitian response is real", forward.imag, 0, 1e-12);
assert("normalised response bound", Math.abs(forward.real) <= 1 + 1e-12);

const noHermitian = sampleTrack(pair, dec, wavelengthM, 6);
const asymmetric = response(noHermitian, l, m);
assert("non-Hermitian sample can carry imaginary phase", Math.abs(asymmetric.imag) > 1e-3);

console.log("PASS sampling response normalisation and Hermitian symmetry");
