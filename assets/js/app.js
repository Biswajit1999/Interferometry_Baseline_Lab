const ids = ["baseline", "wavelength", "separation", "positionAngle", "fluxRatio", "hour", "dec"];
const input = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const label = {
  baseline: document.getElementById("baselineOut"),
  wavelength: document.getElementById("wavelengthOut"),
  separation: document.getElementById("separationOut"),
  positionAngle: document.getElementById("paOut"),
  fluxRatio: document.getElementById("fluxRatioOut"),
  hour: document.getElementById("hourOut"),
  dec: document.getElementById("decOut"),
  resolution: document.getElementById("resolution"),
  fringe: document.getElementById("fringe"),
  projected: document.getElementById("projected"),
  spatialFrequency: document.getElementById("spatialFrequency"),
  visibilityAmp: document.getElementById("visibilityAmp"),
  visibilityPhase: document.getElementById("visibilityPhase"),
};

function val(id) { return Number(input[id].value); }
function rad(deg) { return deg * Math.PI / 180; }
function masFromRad(x) { return x * 206264806.247; }

function setup(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = width * Number(canvas.height) / Number(canvas.width);
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width, height };
}

function model() {
  const baseline = val("baseline");
  const wavelengthUm = val("wavelength");
  const hour = rad(val("hour"));
  const dec = rad(val("dec"));
  const uMeters = baseline * Math.sin(hour);
  const vMeters = -baseline * Math.sin(dec) * Math.cos(hour);
  const projected = Math.sqrt(uMeters ** 2 + vMeters ** 2);
  const wavelengthM = wavelengthUm * 1e-6;
  const uLambda = uMeters / wavelengthM;
  const vLambda = vMeters / wavelengthM;
  const resolutionMas = masFromRad(wavelengthM / Math.max(projected, 1e-6));
  const separationMas = val("separation");
  const pa = rad(val("positionAngle"));
  const fluxRatio = val("fluxRatio");
  const visibility = binaryVisibility(uLambda, vLambda, separationMas, pa, fluxRatio);
  return { baseline, wavelengthUm, wavelengthM, projected, uLambda, vLambda, resolutionMas, separationMas, pa, fluxRatio, visibility, hour, dec };
}

function binaryVisibility(uLambda, vLambda, separationMas, pa, fluxRatio) {
  const masToRad = 1 / 206264806.247;
  const separationRad = separationMas * masToRad;
  const dx = separationRad * Math.sin(pa);
  const dy = separationRad * Math.cos(pa);
  const phase = -2 * Math.PI * (uLambda * dx + vLambda * dy);
  const real = (1 + fluxRatio * Math.cos(phase)) / (1 + fluxRatio);
  const imag = (fluxRatio * Math.sin(phase)) / (1 + fluxRatio);
  return { amplitude: Math.hypot(real, imag), phase: Math.atan2(imag, real) };
}

function drawFringes(m) {
  const { ctx, width, height } = setup(document.getElementById("fringeCanvas"));
  const pixels = 220;
  const cellW = width / pixels;
  const cellH = height / 80;
  const sepPhase = (m.separationMas / Math.max(m.resolutionMas, 0.001)) * Math.PI;
  for (let y = 0; y < 80; y += 1) {
    for (let x = 0; x < pixels; x += 1) {
      const u = (x / pixels - 0.5) * 10;
      const envelope = Math.exp(-0.5 * (u / 3.5) ** 2);
      const fringe = 0.5 + 0.5 * Math.cos(2 * Math.PI * u + sepPhase);
      const intensity = envelope * fringe;
      ctx.fillStyle = `rgb(${Math.round(25 + 230 * intensity)}, ${Math.round(40 + 140 * intensity)}, ${Math.round(70 + 80 * intensity)})`;
      ctx.fillRect(x * cellW, y * cellH, cellW + 1, cellH + 1);
    }
  }
  ctx.fillStyle = "#aab2c0";
  ctx.font = "13px system-ui";
  ctx.fillText("fringe phase responds to source separation and projected baseline", 18, height - 18);
}

function drawUv(m) {
  const { ctx, width, height } = setup(document.getElementById("uvCanvas"));
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, width, height);
  const cx = width / 2;
  const cy = height / 2;
  const scale = Math.min(width, height) * 0.38;
  ctx.strokeStyle = "rgba(255,255,255,.1)";
  ctx.beginPath(); ctx.moveTo(20, cy); ctx.lineTo(width - 20, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, 20); ctx.lineTo(cx, height - 20); ctx.stroke();

  ctx.strokeStyle = "#5bd8ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 180; i += 1) {
    const h = rad(-90 + i);
    const u = Math.sin(h);
    const v = -Math.sin(m.dec) * Math.cos(h);
    const x = cx + u * scale;
    const y = cy - v * scale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  const uNow = Math.sin(m.hour);
  const vNow = -Math.sin(m.dec) * Math.cos(m.hour);
  ctx.fillStyle = "#ffb45c";
  ctx.beginPath();
  ctx.arc(cx + uNow * scale, cy - vNow * scale, 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawVisibilityCurve(m) {
  const { ctx, width, height } = setup(document.getElementById("visibilityCanvas"));
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, width, height);
  const pad = { left: 48, right: 18, top: 24, bottom: 40 };
  ctx.strokeStyle = "rgba(255,255,255,.1)";
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (height - pad.top - pad.bottom) * i / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
  }
  const maxBaseline = Math.max(10, m.baseline * 1.5);
  const px = (b) => pad.left + (b / maxBaseline) * (width - pad.left - pad.right);
  const py = (amp) => height - pad.bottom - amp * (height - pad.top - pad.bottom);
  ctx.strokeStyle = "#5bd8ff";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let i = 0; i <= 220; i += 1) {
    const baseline = maxBaseline * i / 220;
    const scale = baseline / Math.max(m.baseline, 1e-6);
    const vis = binaryVisibility(m.uLambda * scale, m.vLambda * scale, m.separationMas, m.pa, m.fluxRatio);
    const x = px(baseline);
    const y = py(vis.amplitude);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = "#ffb45c";
  ctx.beginPath();
  ctx.arc(px(m.baseline), py(m.visibility.amplitude), 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#aab2c0";
  ctx.font = "12px system-ui";
  ctx.fillText("baseline length (m)", width - 128, height - 14);
  ctx.fillText("|V|", 14, 22);
}

function render() {
  const m = model();
  label.baseline.textContent = `${m.baseline.toFixed(0)} m`;
  label.wavelength.textContent = `${m.wavelengthUm.toFixed(2)} um`;
  label.separation.textContent = `${m.separationMas.toFixed(1)} mas`;
  label.positionAngle.textContent = `${val("positionAngle").toFixed(0)} deg`;
  label.fluxRatio.textContent = m.fluxRatio.toFixed(2);
  label.hour.textContent = `${val("hour").toFixed(0)} deg`;
  label.dec.textContent = `${val("dec").toFixed(0)} deg`;
  label.resolution.textContent = `${m.resolutionMas.toFixed(3)} mas`;
  label.fringe.textContent = `${m.resolutionMas.toFixed(3)} mas`;
  label.projected.textContent = `${m.projected.toFixed(1)} m`;
  label.spatialFrequency.textContent = `${(m.projected / m.wavelengthM / 1e6).toFixed(1)} Mlambda`;
  label.visibilityAmp.textContent = m.visibility.amplitude.toFixed(3);
  label.visibilityPhase.textContent = `${m.visibility.phase.toFixed(2)} rad`;
  drawFringes(m);
  drawUv(m);
  drawVisibilityCurve(m);
}

ids.forEach((id) => input[id].addEventListener("input", render));
window.addEventListener("resize", render);
render();
