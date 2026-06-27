const ids = ["baseline", "baselineAzimuth", "baselineElevation", "wavelength", "separation", "positionAngle", "fluxRatio", "hour", "dec", "trackHours"];
const input = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const label = {
  baseline: document.getElementById("baselineOut"), baselineAzimuth: document.getElementById("azimuthOut"), baselineElevation: document.getElementById("elevationOut"), wavelength: document.getElementById("wavelengthOut"), separation: document.getElementById("separationOut"), positionAngle: document.getElementById("paOut"), fluxRatio: document.getElementById("fluxRatioOut"), hour: document.getElementById("hourOut"), dec: document.getElementById("decOut"), trackHours: document.getElementById("trackOut"), resolution: document.getElementById("resolution"), fringe: document.getElementById("fringe"), projected: document.getElementById("projected"), spatialFrequency: document.getElementById("spatialFrequency"), visibilityAmp: document.getElementById("visibilityAmp"), visibilityPhase: document.getElementById("visibilityPhase"), u: document.getElementById("uReadout"), v: document.getElementById("vReadout"), w: document.getElementById("wReadout"), beam: document.getElementById("beamReadout"),
};

function val(id) { return Number(input[id].value); }
function rad(deg) { return deg * Math.PI / 180; }
function masFromRad(x) { return x * 206264806.247; }
function formatMlambda(value) { return `${(value / 1e6).toFixed(2)} Mlambda`; }

function setup(canvas) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, canvas.clientWidth);
  const aspect = Number(canvas.getAttribute("height")) / Number(canvas.getAttribute("width"));
  const height = Math.max(1, width * aspect);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width, height };
}

function baselineEnu(length, azimuthDeg, elevationDeg) {
  const az = rad(azimuthDeg); // East of North.
  const el = rad(elevationDeg);
  return {
    east: length * Math.cos(el) * Math.sin(az),
    north: length * Math.cos(el) * Math.cos(az),
    up: length * Math.sin(el),
  };
}

// ENU baseline to (u, v, w) convention for a source at hour angle H and declination delta.
function uvwMeters(enu, hourRad, decRad) {
  const { east, north, up } = enu;
  return {
    u: east * Math.sin(hourRad) + north * Math.cos(hourRad),
    v: -east * Math.sin(decRad) * Math.cos(hourRad) + north * Math.sin(decRad) * Math.sin(hourRad) + up * Math.cos(decRad),
    w: east * Math.cos(decRad) * Math.cos(hourRad) - north * Math.cos(decRad) * Math.sin(hourRad) + up * Math.sin(decRad),
  };
}

function binaryVisibility(uLambda, vLambda, separationMas, pa, fluxRatio) {
  const separationRad = separationMas / 206264806.247;
  const dx = separationRad * Math.sin(pa);
  const dy = separationRad * Math.cos(pa);
  const phase = -2 * Math.PI * (uLambda * dx + vLambda * dy);
  const real = (1 + fluxRatio * Math.cos(phase)) / (1 + fluxRatio);
  const imag = (fluxRatio * Math.sin(phase)) / (1 + fluxRatio);
  return { amplitude: Math.hypot(real, imag), phase: Math.atan2(imag, real) };
}

function model() {
  const baseline = val("baseline");
  const wavelengthUm = val("wavelength");
  const wavelengthM = wavelengthUm * 1e-6;
  const hour = rad(val("hour"));
  const dec = rad(val("dec"));
  const enu = baselineEnu(baseline, val("baselineAzimuth"), val("baselineElevation"));
  const uvwM = uvwMeters(enu, hour, dec);
  const uLambda = uvwM.u / wavelengthM;
  const vLambda = uvwM.v / wavelengthM;
  const wLambda = uvwM.w / wavelengthM;
  const projected = Math.hypot(uvwM.u, uvwM.v);
  const resolutionMas = masFromRad(wavelengthM / Math.max(projected, 1e-12));
  const separationMas = val("separation");
  const pa = rad(val("positionAngle"));
  const fluxRatio = val("fluxRatio");
  const visibility = binaryVisibility(uLambda, vLambda, separationMas, pa, fluxRatio);
  const track = sampleTrack(enu, dec, wavelengthM, val("trackHours"));
  const maxUv = Math.max(1, ...track.flatMap((point) => [Math.abs(point.u), Math.abs(point.v)]), Math.abs(uLambda), Math.abs(vLambda));
  return { baseline, wavelengthUm, wavelengthM, hour, dec, enu, uvwM, uLambda, vLambda, wLambda, projected, resolutionMas, separationMas, pa, fluxRatio, visibility, track, maxUv };
}

function sampleTrack(enu, dec, wavelengthM, trackHours) {
  const points = [];
  const samples = 181;
  for (let i = 0; i < samples; i += 1) {
    const hour = rad((-trackHours + (2 * trackHours * i) / (samples - 1)) * 15);
    const uvw = uvwMeters(enu, hour, dec);
    points.push({ u: uvw.u / wavelengthM, v: uvw.v / wavelengthM, w: uvw.w / wavelengthM, hour });
  }
  return points;
}

function drawAxes(ctx, width, height, pad, xText, yText) {
  ctx.strokeStyle = "rgba(255,255,255,.10)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const x = pad.left + i * (width - pad.left - pad.right) / 4;
    const y = pad.top + i * (height - pad.top - pad.bottom) / 4;
    ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, height - pad.bottom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
  }
  ctx.fillStyle = "#aab2c0";
  ctx.font = "12px system-ui";
  ctx.fillText(yText, 12, 20);
  ctx.fillText(xText, width - 126, height - 14);
}

function drawFringes(m) {
  const { ctx, width, height } = setup(document.getElementById("fringeCanvas"));
  ctx.fillStyle = "#0d1117"; ctx.fillRect(0, 0, width, height);
  const pad = { left: 46, right: 20, top: 24, bottom: 42 };
  drawAxes(ctx, width, height, pad, "instrumental phase", "correlated intensity");
  const yMid = (pad.top + height - pad.bottom) / 2;
  const scaleY = (height - pad.top - pad.bottom) * 0.42;
  ctx.strokeStyle = "#5bd8ff"; ctx.lineWidth = 2.4; ctx.beginPath();
  for (let i = 0; i <= 360; i += 1) {
    const phase = -4 * Math.PI + (8 * Math.PI * i) / 360;
    const intensity = 0.5 + 0.5 * m.visibility.amplitude * Math.cos(phase + m.visibility.phase);
    const x = pad.left + i * (width - pad.left - pad.right) / 360;
    const y = yMid - (intensity - 0.5) * 2 * scaleY;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = "#ffb45c"; ctx.font = "12px ui-monospace, monospace";
  ctx.fillText(`|V| = ${m.visibility.amplitude.toFixed(3)}    arg(V) = ${m.visibility.phase.toFixed(3)} rad`, pad.left, height - 18);
}

function drawUv(m) {
  const { ctx, width, height } = setup(document.getElementById("uvCanvas"));
  ctx.fillStyle = "#0d1117"; ctx.fillRect(0, 0, width, height);
  const pad = { left: 58, right: 24, top: 24, bottom: 42 };
  const limit = m.maxUv * 1.12;
  const sx = (u) => pad.left + ((u + limit) / (2 * limit)) * (width - pad.left - pad.right);
  const sy = (v) => height - pad.bottom - ((v + limit) / (2 * limit)) * (height - pad.top - pad.bottom);
  drawAxes(ctx, width, height, pad, "u (lambda)", "v (lambda)");
  ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.moveTo(sx(-limit), sy(0)); ctx.lineTo(sx(limit), sy(0)); ctx.stroke(); ctx.beginPath(); ctx.moveTo(sx(0), sy(-limit)); ctx.lineTo(sx(0), sy(limit)); ctx.stroke();
  const trackPath = (sign, colour) => {
    ctx.strokeStyle = colour; ctx.lineWidth = sign === 1 ? 2.2 : 1.3; ctx.beginPath();
    m.track.forEach((p, index) => { const x = sx(sign * p.u); const y = sy(sign * p.v); if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.stroke();
  };
  trackPath(1, "#5bd8ff"); trackPath(-1, "rgba(91,216,255,.35)");
  ctx.fillStyle = "#ffb45c"; ctx.beginPath(); ctx.arc(sx(m.uLambda), sy(m.vLambda), 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#aab2c0"; ctx.font = "12px system-ui";
  ctx.fillText(`track: plus or minus ${val("trackHours").toFixed(1)} h    u,v scale: plus or minus ${(limit / 1e6).toFixed(2)} Mlambda`, pad.left, height - 16);
  ctx.fillStyle = "#5bd8ff"; ctx.fillText("observed track", width - 194, 20);
  ctx.fillStyle = "rgba(91,216,255,.55)"; ctx.fillText("Hermitian conjugate", width - 194, 36);
}

function drawVisibilityCurve(m) {
  const { ctx, width, height } = setup(document.getElementById("visibilityCanvas"));
  ctx.fillStyle = "#0d1117"; ctx.fillRect(0, 0, width, height);
  const pad = { left: 48, right: 18, top: 24, bottom: 40 };
  drawAxes(ctx, width, height, pad, "baseline length (m)", "|V|");
  const maxBaseline = Math.max(10, m.baseline * 1.5);
  const px = (b) => pad.left + (b / maxBaseline) * (width - pad.left - pad.right);
  const py = (amp) => height - pad.bottom - amp * (height - pad.top - pad.bottom);
  ctx.strokeStyle = "#5bd8ff"; ctx.lineWidth = 2.4; ctx.beginPath();
  for (let i = 0; i <= 240; i += 1) {
    const scale = i / 240;
    const vis = binaryVisibility(m.uLambda * scale * maxBaseline / m.baseline, m.vLambda * scale * maxBaseline / m.baseline, m.separationMas, m.pa, m.fluxRatio);
    const x = px(maxBaseline * scale); const y = py(vis.amplitude);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = "#ffb45c"; ctx.beginPath(); ctx.arc(px(m.baseline), py(m.visibility.amplitude), 5.5, 0, Math.PI * 2); ctx.fill();
}

function beamColour(value) {
  const t = Math.max(-1, Math.min(1, value));
  if (t >= 0) return `rgb(${Math.round(18 + 235 * t)},${Math.round(24 + 185 * t)},${Math.round(42 + 190 * t)})`;
  return `rgb(${Math.round(35 + 120 * (1 + t))},${Math.round(22 + 75 * (1 + t))},${Math.round(70 + 140 * (1 + t))})`;
}

function drawDirtyBeam(m) {
  const { ctx, width, height } = setup(document.getElementById("dirtyBeamCanvas"));
  ctx.fillStyle = "#0d1117"; ctx.fillRect(0, 0, width, height);
  const n = 150;
  const image = ctx.createImageData(n, n);
  const samples = m.track.filter((_, index) => index % 3 === 0);
  const maxUv = m.maxUv;
  const fieldRad = 5.5 / maxUv;
  for (let y = 0; y < n; y += 1) {
    const directionM = fieldRad * (1 - 2 * (y + 0.5) / n);
    for (let x = 0; x < n; x += 1) {
      const directionL = fieldRad * (2 * (x + 0.5) / n - 1);
      let real = 0;
      for (const point of samples) real += Math.cos(2 * Math.PI * (point.u * directionL + point.v * directionM));
      const value = real / samples.length;
      const pixel = 4 * (y * n + x);
      const colour = beamColour(value);
      image.data[pixel] = Number(colour.match(/\d+/g)[0]); image.data[pixel + 1] = Number(colour.match(/\d+/g)[1]); image.data[pixel + 2] = Number(colour.match(/\d+/g)[2]); image.data[pixel + 3] = 255;
    }
  }
  const raw = document.createElement("canvas"); raw.width = n; raw.height = n; raw.getContext("2d").putImageData(image, 0, 0);
  const size = Math.min(width - 120, height - 48);
  const x = (width - size) / 2; const y = 22;
  ctx.imageSmoothingEnabled = false; ctx.drawImage(raw, x, y, size, size);
  ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.strokeRect(x, y, size, size);
  const fovMas = masFromRad(fieldRad);
  ctx.fillStyle = "#aab2c0"; ctx.font = "12px system-ui";
  ctx.fillText(`Natural-weighted dirty beam from ${samples.length * 2} uv samples including conjugates. Field: plus or minus ${fovMas.toFixed(2)} mas.`, 18, height - 16);
}

function render() {
  const m = model();
  label.baseline.textContent = `${m.baseline.toFixed(0)} m`;
  label.baselineAzimuth.textContent = `${val("baselineAzimuth").toFixed(0)} deg E of N`;
  label.baselineElevation.textContent = `${val("baselineElevation").toFixed(0)} deg`;
  label.wavelength.textContent = `${m.wavelengthUm.toFixed(2)} um`;
  label.separation.textContent = `${m.separationMas.toFixed(1)} mas`;
  label.positionAngle.textContent = `${val("positionAngle").toFixed(0)} deg`;
  label.fluxRatio.textContent = m.fluxRatio.toFixed(2);
  label.hour.textContent = `${(val("hour") / 15).toFixed(1)} h`;
  label.dec.textContent = `${val("dec").toFixed(0)} deg`;
  label.trackHours.textContent = `plus or minus ${val("trackHours").toFixed(1)} h`;
  label.resolution.textContent = `${m.resolutionMas.toFixed(3)} mas`;
  label.fringe.textContent = `${m.resolutionMas.toFixed(3)} mas`;
  label.projected.textContent = `${m.projected.toFixed(1)} m`;
  label.spatialFrequency.textContent = formatMlambda(Math.hypot(m.uLambda, m.vLambda));
  label.visibilityAmp.textContent = m.visibility.amplitude.toFixed(3);
  label.visibilityPhase.textContent = `${m.visibility.phase.toFixed(3)} rad`;
  label.u.textContent = formatMlambda(m.uLambda); label.v.textContent = formatMlambda(m.vLambda); label.w.textContent = formatMlambda(m.wLambda);
  label.beam.textContent = `${m.resolutionMas.toFixed(3)} mas`;
  drawFringes(m); drawUv(m); drawVisibilityCurve(m); drawDirtyBeam(m);
}

ids.forEach((id) => input[id].addEventListener("input", render));
window.addEventListener("resize", render);
render();
