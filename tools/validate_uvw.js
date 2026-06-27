// Run with: node tools/validate_uvw.js
// Checks the horizontal east-west baseline convention used in assets/js/app.js.

function uvwMeters(baseline, hour, dec) {
  return {
    u: baseline * Math.sin(hour),
    v: -baseline * Math.sin(dec) * Math.cos(hour),
    w: baseline * Math.cos(dec) * Math.cos(hour),
  };
}

function close(actual, expected, tolerance = 1e-12) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`expected ${expected}, received ${actual}`);
  }
}

const baseline = 120;
const meridianEquator = uvwMeters(baseline, 0, 0);
close(meridianEquator.u, 0);
close(meridianEquator.v, 0);
close(meridianEquator.w, baseline);

const sixHoursEquator = uvwMeters(baseline, Math.PI / 2, 0);
close(sixHoursEquator.u, baseline);
close(sixHoursEquator.v, 0);
close(sixHoursEquator.w, 0);

const meridianPole = uvwMeters(baseline, 0, Math.PI / 2);
close(meridianPole.u, 0);
close(meridianPole.v, -baseline);
close(meridianPole.w, 0);

console.log('PASS horizontal east-west uvw limits');
