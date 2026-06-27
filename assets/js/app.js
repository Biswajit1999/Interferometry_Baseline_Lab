const ids = ["baseline", "wavelength", "separation", "positionAngle", "fluxRatio", "hour", "dec"];
const input = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const label = {
  baseline: document.getElementById("baselineOut"), wavelength: document.getElementById("wavelengthOut"), separation: document.getElementById("separationOut"), positionAngle: document.getElementById("paOut"), fluxRatio: document.getElementById("fluxRatioOut"), hour: document.getElementById("hourOut"), dec: document.getElementById("decOut"), resolution: document.getElementById("resolution"), fringe: document.getElementById("fringe"), projected: document.getElementById("projected"), spatialFrequency: document.getElementById("spatialFrequency"), visibilityAmp: document.getElementById("visibilityAmp"), visibilityPhase: document.getElementById("visibilityPhase"),
};

function val(id) { return Number(input[id].value); }
function rad(deg) { return deg * Math.PI / 180; }
function masFromRad(x) { return x * 206264806.247; }
function setup(canvas) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, canvas.clientWidth);
  const aspect = Number(canvas.getAttribute("height")) / Number(canvas.getAttribute("width"));
  const height = Math.max(1, width * aspect);
  canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d"); ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width, height };
}

// A single horizontal east-west ENU baseline. The source direction rotates the
// baseline into u,v,w through Earth rotation; w is retained for transparency.
function uvwMeters(baseline, hour, dec) {
  return {
    u: baseline * Math.sin(hour),
    v: -baseline * Math.sin(dec) * Math.cos(hour),
    w: baseline * Math.cos(dec) * Math.cos(hour),
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
  const uvwM = uvwMeters(baseline, hour, dec);
  const uLambda = uvwM.u / wavelengthM;
  const vLambda = uvwM.v / wavelengthM;
  const wLambda = uvwM.w / wavelengthM;
  const projected = Math.hypot(uvwM.u, uvwM.v);
  const resolutionMas = masFromRad(wavelengthM / Math.max(projected, 1e-12));
  const separationMas = val("separation");
  const pa = rad(val("positionAngle"));
  const fluxRatio = val("fluxRatio");
  const visibility = binaryVisibility(uLambda, vLambda, separationMas, pa, fluxRatio);
  const track = [];
  for (let i = 0; i <= 180; i += 1) {
    const h = rad(-90 + i);
    const uvw = uvwMeters(baseline, h, dec);
    track.push({ u: uvw.u / wavelengthM, v: uvw.v / wavelengthM, w: uvw.w / wavelengthM });
  }
  const maxUv = Math.max(1, ...track.flatMap((point) => [Math.abs(point.u), Math.abs(point.v)]));
  return { baseline, wavelengthUm, wavelengthM, hour, dec, uvwM, uLambda, vLambda, wLambda, projected, resolutionMas, separationMas, pa, fluxRatio, visibility, track, maxUv };
}

function drawGrid(ctx, width, height, pad, xLabel, yLabel) {
  ctx.strokeStyle = "rgba(255,255,255,.10)"; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const x = pad.left + i * (width - pad.left - pad.right) / 4;
    const y = pad.top + i * (height - pad.top - pad.bottom) / 4;
    ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, height - pad.bottom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
  }
  ctx.fillStyle = "#aab2c0"; ctx.font = "12px system-ui";
  ctx.fillText(yLabel, 12, 20); ctx.fillText(xLabel, width - 132, height - 14);
}

function drawFringes(m) {
  const { ctx, width, height } = setup(document.getElementById("fringeCanvas"));
  ctx.fillStyle = "#0d1117"; ctx.fillRect(0, 0, width, height);
  const pad = { left: 46, right: 20, top: 24, bottom: 42 };
  drawGrid(ctx, width, height, pad, "instrumental phase", "correlated intensity");
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
  ctx.fillText(`|V| = ${m.visibility.amplitude.toFixed(3)}  arg(V) = ${m.visibility.phase.toFixed(3)} rad`, pad.left, height - 18);
}

function drawUv(m) {
  const { ctx, width, height } = setup(document.getElementById("uvCanvas"));
  ctx.fillStyle = "#0d1117"; ctx.fillRect(0, 0, width, height);
  const pad = { left: 58, right: 24, top: 24, bottom: 42 };
  const limit = m.maxUv * 1.12;
  const sx = (u) => pad.left + ((u + limit) / (2 * limit)) * (width - pad.left - pad.right);
  const sy = (v) => height - pad.bottom - ((v + limit) / (2 * limit)) * (height - pad.top - pad.bottom);
  drawGrid(ctx, width, height, pad, "u (lambda)", "v (lambda)");
  ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.moveTo(sx(-limit), sy(0)); ctx.lineTo(sx(limit), sy(0)); ctx.stroke(); ctx.beginPath(); ctx.moveTo(sx(0), sy(-limit)); ctx.lineTo(sx(0), sy(limit)); ctx.stroke();
  const plotTrack = (sign, colour, widthPx) => { ctx.strokeStyle = colour; ctx.lineWidth = widthPx; ctx.beginPath(); m.track.forEach((p, i) => { const x = sx(sign * p.u); const y = sy(sign * p.v); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke(); };
  plotTrack(1, "#5bd8ff", 2.2); plotTrack(-1, "rgba(91,216,255,.35)", 1.2);
  ctx.fillStyle = "#ffb45c"; ctx.beginPath(); ctx.arc(sx(m.uLambda), sy(m.vLambda), 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#aab2c0"; ctx.font = "12px system-ui";
  ctx.fillText(`east-west ENU baseline; source track: -6 h to +6 h; current w = ${(m.wLambda / 1e6).toFixed(2)} Mlambda`, pad.left, height - 16);
}

function pixelColour(value) {
  const t = Math.max(-1, Math.min(1, value));
  if (t >= 0) return [Math.round(18 + 235 * t), Math.round(24 + 185 * t), Math.round(42 + 190 * t)];
  return [Math.round(35 + 120 * (1 + t)), Math.round(22 + 75 * (1 + t)), Math.round(70 + 140 * (1 + t))];
}

function drawVisibilityAndBeam(m) {
  const { ctx, width, height } = setup(document.getElementById("visibilityCanvas"));
  ctx.fillStyle = "#0d1117"; ctx.fillRect(0, 0, width, height);
  const split = width * 0.57;
  const pad = { left: 48, right: 18, top: 28, bottom: 40 };
  const maxBaseline = Math.max(10, m.baseline * 1.5);
  const px = (b) => pad.left + (b / maxBaseline) * (split - pad.left - pad.right);
  const py = (amp) => height - pad.bottom - amp * (height - pad.top - pad.bottom);
  ctx.strokeStyle = "rgba(255,255,255,.10)"; for (let i = 0; i <= 4; i += 1) { const y = pad.top + (height - pad.top - pad.bottom) * i / 4; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(split - pad.right, y); ctx.stroke(); }
  ctx.strokeStyle = "#5bd8ff"; ctx.lineWidth = 2.3; ctx.beginPath();
  for (let i = 0; i <= 220; i += 1) { const scale = i / 220; const vis = binaryVisibility(m.uLambda * scale * maxBaseline / m.baseline, m.vLambda * scale * maxBaseline / m.baseline, m.separationMas, m.pa, m.fluxRatio); const x = px(maxBaseline * scale); const y = py(vis.amplitude); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.stroke(); ctx.fillStyle = "#ffb45c"; ctx.beginPath(); ctx.arc(px(m.baseline), py(m.visibility.amplitude), 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#aab2c0"; ctx.font = "12px system-ui"; ctx.fillText("binary visibility amplitude", pad.left, 18); ctx.fillText("baseline length (m)", split - 130, height - 14);

  const n = 112; const image = ctx.createImageData(n, n); const samples = m.track.filter((_, i) => i % 3 === 0); const fieldRad = 5.5 / m.maxUv;
  for (let y = 0; y < n; y += 1) {
    const directionM = fieldRad * (1 - 2 * (y + 0.5) / n);
    for (let x = 0; x < n; x += 1) {
      const directionL = fieldRad * (2 * (x + 0.5) / n - 1);
      let real = 0;
      for (const point of samples) real += Math.cos(2 * Math.PI * (point.u * directionL + point.v * directionM));
      const [r, g, b] = pixelColour(real / samples.length); const p = 4 * (y * n + x);
      image.data[p] = r; image.data[p + 1] = g; image.data[p + 2] = b; image.data[p + 3] = 255;
    }
  }
  const raw = document.createElement("canvas"); raw.width = n; raw.height = n; raw.getContext("2d").putImageData(image, 0, 0);
  const size = Math.min(height - 48, width - split - 26); const x0 = split + (width - split - size) / 2; const y0 = 24;
  ctx.imageSmoothingEnabled = false; ctx.drawImage(raw, x0, y0, size, size); ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.strokeRect(x0, y0, size, size);
  ctx.fillStyle = "#aab2c0"; ctx.fillText("natural-weighted response", x0, 18); ctx.fillText(`plus/minus ${masFromRad(fieldRad).toFixed(2)} mas`, x0, height - 14);
}

function render() {
  const m = model();
  label.baseline.textContent = `${m.baseline.toFixed(0)} m`; label.wavelength.textContent = `${m.wavelengthUm.toFixed(2)} um`; label.separation.textContent = `${m.separationMas.toFixed(1)} mas`; label.positionAngle.textContent = `${val("positionAngle").toFixed(0)} deg`; label.fluxRatio.textContent = m.fluxRatio.toFixed(2); label.hour.textContent = `${val("hour").toFixed(0)} deg`; label.dec.textContent = `${val("dec").toFixed(0)} deg`;
  label.resolution.textContent = `${m.resolutionMas.toFixed(3)} mas`; label.fringe.textContent = `${m.resolutionMas.toFixed(3)} mas`; label.projected.textContent = `${m.projected.toFixed(1)} m`; label.spatialFrequency.textContent = `${(Math.hypot(m.uLambda, m.vLambda) / 1e6).toFixed(2)} Mlambda`; label.visibilityAmp.textContent = m.visibility.amplitude.toFixed(3); label.visibilityPhase.textContent = `${m.visibility.phase.toFixed(3)} rad`;
  drawFringes(m); drawUv(m); drawVisibilityAndBeam(m);
}

ids.forEach((id) => input[id].addEventListener("input", render));
window.addEventListener("resize", render);
render();
