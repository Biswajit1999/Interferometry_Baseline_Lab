// Run with: node tools/validate_arrays.js

function pairCount(count) {
  return count * (count - 1) / 2;
}

function uvw(east, north, up, hour, dec) {
  return {
    u: east * Math.sin(hour) + north * Math.cos(hour),
    v: -east * Math.sin(dec) * Math.cos(hour) + north * Math.sin(dec) * Math.sin(hour) + up * Math.cos(dec),
    w: east * Math.cos(dec) * Math.cos(hour) - north * Math.cos(dec) * Math.sin(hour) + up * Math.sin(dec),
  };
}

function close(actual, expected) {
  if (Math.abs(actual - expected) > 1e-12) throw new Error(`expected ${expected}, received ${actual}`);
}

const b = 120;
const meridian = uvw(b, 0, 0, 0, 0);
close(meridian.u, 0);
close(meridian.v, 0);
close(meridian.w, b);
const quarterTurn = uvw(b, 0, 0, Math.PI / 2, 0);
close(quarterTurn.u, b);
close(quarterTurn.v, 0);
close(quarterTurn.w, 0);
const yAxis = uvw(0, b, 0, 0, 0);
close(yAxis.u, b);
close(yAxis.v, 0);
close(yAxis.w, 0);
if (pairCount(2) !== 1 || pairCount(3) !== 3 || pairCount(4) !== 6) throw new Error("incorrect pair count");
console.log("PASS ENU projection limits and array pair counts");
