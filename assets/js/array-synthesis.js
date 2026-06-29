const controlIds = ["baseline", "wavelength", "separation", "positionAngle", "fluxRatio", "hour", "dec", "trackHours"];
const control = Object.fromEntries(controlIds.map((id) => [id, document.getElementById(id)]));
const scenarioSelect = document.getElementById("scenario");
const arraySelect = document.getElementById("arrayPreset");
const label = {
  baseline: document.getElementById("baselineOut"),
  wavelength: document.getElementById("wavelengthOut"),
  separation: document.getElementById("separationOut"),
  positionAngle: document.getElementById("paOut"),
  fluxRatio: document.getElementById("fluxRatioOut"),
  hour: document.getElementById("hourOut"),
  dec: document.getElementById("decOut"),
  trackHours: document.getElementById("trackOut"),
  resolution: document.getElementById("resolution"),
  fringe: document.getElementById("fringe"),
  projected: document.getElementById("projected"),
  baselines: document.getElementById("baselineCount"),
  spatialFrequency: document.getElementById("spatialFrequency"),
  visibilityAmp: document.getElementById("visibilityAmp"),
  visibilityPhase: document.getElementById("visibilityPhase"),
  u: document.getElementById("uReadout"),
  v: document.getElementById("vReadout"),
  w: document.getElementById("wReadout"),
  scenarioName: document.getElementById("scenarioName"),
  scenarioNote: document.getElementById("scenarioNote"),
  arrayName: document.getElementById("arrayName"),
};

const SCENARIOS = {
  custom: {
    name: "Custom synthetic synthesis experiment",
    note: "The source, visibilities, coverage and response are generated locally from the analytic model. No observatory archive visibilities are loaded.",
    baseline: 120,
    wavelength: 1.65,
    hour: 35,
    dec: 20,
    trackHours: 6,
    array: "ew2",
  },
  "alma-scale": {
    name: "ALMA long-baseline scale experiment",
    note: "The 16 km and 0.75 mm values are a documented long-baseline observing scale. The compact three-arm layout, source and visibilities shown here are synthetic and are not ALMA archive data.",
    baseline: 16000,
    wavelength: 750,
    hour: 25,
    dec: -20,
    trackHours: 5,
    array: "y4",
  },
};

const ARRAY_PRESETS = {
  ew2: {
    name: "Two collector east-west",
    description: "One horizontal east-west baseline. This is the smallest useful synthesis case.",
    positions(scale) {
      return [[0, 0, 0], [scale, 0, 0]];
    },
  },
  l3: {
    name: "Three collector L layout",
    description: "Three collectors form east-west, north-south and diagonal baselines.",
    positions(scale) {
      return [[0, 0, 0], [scale, 0, 0], [0, scale, 0]];
    },
  },
  y4: {
    name: "Four collector Y layout",
    description: "A compact idealised three-arm layout with six baseline pairs. It is not a model of an actual observatory configuration.",
    positions(scale) {
      const root3 = Math.sqrt(3) / 2;
      return [[0, 0, 0], [0, scale, 0], [root3 * scale, -0.5 * scale, 0], [-root3 * scale, -0.5 * scale, 0]];
    },
  },
};

function val(id) { return Number(control[id].value); }
function rad(deg) { return deg * Math.PI / 180; }
function masFromRad(value) { return value * 206264806.247; }
function formatDistance(metres) { return metres >= 1000 ? `${(metres / 1000).toFixed(2)} km` : `${metres.toFixed(0)} m`; }
function formatWavelength(microns) { return microns >= 1000 ? `${(microns / 1000).toFixed(3)} mm` : `${microns.toFixed(2)} um`; }
function formatMlambda(value) { return `${(value / 1e6).toFixed(2)} Mlambda`; }
function activeScenario() { return SCENARIOS[scenarioSelect.value] ?? SCENARIOS.custom; }
function activeArray() { return ARRAY_PRESETS[arraySelect.value] ?? ARRAY_PRESETS.ew2; }

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

function baselinePairs(positions) {
  const pairs = [];
  for (let a = 0; a < positions.length; a += 1) {
    for (let b = a + 1; b < positions.length; b += 1) {
      const east = positions[b][0] - positions[a][0];
      const north = positions[b][1] - positions[a][1];
      const up = positions[b][2] - positions[a][2];
      pairs.push({ a, b, east, north, up, length: Math.hypot(east, north, up) });
    }
  }
  return pairs;
}

// Standard ENU baseline to source-frame uvw transformation for hour angle H and declination delta.
function uvwMeters(pair, hour, dec) {
  return {
    u: pair.east * Math.sin(hour) + pair.north * Math.cos(hour),
    v: -pair.east * Math.sin(dec) * Math.cos(hour) + pair.north * Math.sin(dec) * Math.sin(hour) + pair.up * Math.cos(dec),
    w: pair.east * Math.cos(dec) * Math.cos(hour) - pair.north * Math.cos(dec) * Math.sin(hour) + pair.up * Math.sin(dec),
  };
}

function binaryVisibility(uLambda, vLambda, separationMas, positionAngle, fluxRatio) {
  const separationRad = separationMas / 206264806.247;
  const dx = separationRad * Math.sin(positionAngle);
  const dy = separationRad * Math.cos(positionAngle);
  const phase = -2 * Math.PI * (uLambda * dx + vLambda * dy);
  const real = (1 + fluxRatio * Math.cos(phase)) / (1 + fluxRatio);
  const imag = (fluxRatio * Math.sin(phase)) / (1 + fluxRatio);
  return { amplitude: Math.hypot(real, imag), phase: Math.atan2(imag, real) };
}

function sampleTrack(pair, dec, wavelengthM, trackHours) {
  const points = [];
  const samples = 181;
  const halfAngle = rad(trackHours * 15);
  for (let i = 0; i < samples; i += 1) {
    const hour = -halfAngle + (2 * halfAngle * i) / (samples - 1);
    const uvw = uvwMeters(pair, hour, dec);
    points.push({ u: uvw.u / wavelengthM, v: uvw.v / wavelengthM, w: uvw.w / wavelengthM });
  }
  return points;
}

function model() {
  const scale = val("baseline");
  const wavelengthUm = val("wavelength");
  const wavelengthM = wavelengthUm * 1e-6;
  const hour = rad(val("hour"));
  const dec = rad(val("dec"));
  const positions = activeArray().positions(scale);
  const pairs = baselinePairs(positions);
  const current = pairs.map((pair) => {
    const uvwM = uvwMeters(pair, hour, dec);
    const projected = Math.hypot(uvwM.u, uvwM.v);
    return { ...pair, uvwM, projected, u: uvwM.u / wavelengthM, v: uvwM.v / wavelengthM, w: uvwM.w / wavelengthM };
  });
  const selected = current.reduce((best, candidate) => candidate.projected > best.projected ? candidate : best, current[0]);
  const tracks = pairs.map((pair) => sampleTrack(pair, dec, wavelengthM, val("trackHours")));
  const maxUv = Math.max(1, ...tracks.flatMap((track) => track.flatMap((point) => [Math.abs(point.u), Math.abs(point.v)])));
  const separationMas = val("separation");
  const positionAngle = rad(val("positionAngle"));
  const fluxRatio = val("fluxRatio");
  const visibility = binaryVisibility(selected.u, selected.v, separationMas, positionAngle, fluxRatio);
  const resolutionMas = masFromRad(wavelengthM / Math.max(selected.projected, 1e-12));
  return {
    scale, wavelengthUm, wavelengthM, hour, dec, positions, pairs, current, selected, tracks, maxUv,
    separationMas, positionAngle, fluxRatio, visibility, resolutionMas, scenario: activeScenario(), array: activeArray(),
  };
}

function drawGrid(ctx, width, height, pad, xLabel, yLabel) {
  ctx.strokeStyle = "rgba(255,255,255,.10)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const x = pad.left + i * (width - pad.left - pad.right) / 4;
    const y = pad.top + i * (height - pad.top - pad.bottom) / 4;
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, height - pad.bottom);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
  }
  ctx.fillStyle = "#aab2c0";
  ctx.font = "12px system-ui";
  ctx.fillText(yLabel, 12, 20);
  ctx.fillText(xLabel, width - 132, height - 14);
}

function drawArrayLayout(m) {
  const { ctx, width, height } = setup(document.getElementById("arrayCanvas"));
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, width, height);
  const maxCoordinate = Math.max(1, ...m.positions.flatMap((point) => [Math.abs(point[0]), Math.abs(point[1])])) * 1.25;
  const margin = 28;
  const plot = Math.min(width - 2 * margin, height - 2 * margin);
  const cx = width / 2;
  const cy = height / 2;
  const sx = (east) => cx + (east / maxCoordinate) * plot / 2;
  const sy = (north) => cy - (north / maxCoordinate) * plot / 2;
  ctx.strokeStyle = "rgba(255,255,255,.18)";
  ctx.beginPath();
  ctx.moveTo(margin, cy);
  ctx.lineTo(width - margin, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, margin);
  ctx.lineTo(cx, height - margin);
  ctx.stroke();
  ctx.strokeStyle = "rgba(91,216,255,.33)";
  ctx.lineWidth = 1.1;
  for (const pair of m.pairs) {
    const a = m.positions[pair.a];
    const b = m.positions[pair.b];
    ctx.beginPath();
    ctx.moveTo(sx(a[0]), sy(a[1]));
    ctx.lineTo(sx(b[0]), sy(b[1]));
    ctx.stroke();
  }
  m.positions.forEach((point, index) => {
    ctx.fillStyle = "#ffb45c";
    ctx.beginPath();
    ctx.arc(sx(point[0]), sy(point[1]), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#dce9ef";
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText(`A${index + 1}`, sx(point[0]) + 8, sy(point[1]) - 8);
  });
  ctx.fillStyle = "#aab2c0";
  ctx.font = "11px system-ui";
  ctx.fillText("E", width - margin - 10, cy - 8);
  ctx.fillText("N", cx + 8, margin + 12);
  ctx.fillText(`${m.positions.length} collectors, ${m.pairs.length} pairs`, 12, height - 12);
}

function drawFringes(m) {
  const { ctx, width, height } = setup(document.getElementById("fringeCanvas"));
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, width, height);
  const pad = { left: 46, right: 20, top: 24, bottom: 42 };
  drawGrid(ctx, width, height, pad, "instrumental phase", "correlated intensity");
  const yMid = (pad.top + height - pad.bottom) / 2;
  const scaleY = (height - pad.top - pad.bottom) * 0.42;
  ctx.strokeStyle = "#5bd8ff";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let i = 0; i <= 360; i += 1) {
    const phase = -4 * Math.PI + (8 * Math.PI * i) / 360;
    const intensity = 0.5 + 0.5 * m.visibility.amplitude * Math.cos(phase + m.visibility.phase);
    const x = pad.left + i * (width - pad.left - pad.right) / 360;
    const y = yMid - (intensity - 0.5) * 2 * scaleY;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = "#ffb45c";
  ctx.font = "12px ui-monospace, monospace";
  ctx.fillText(`selected A${m.selected.a + 1}-A${m.selected.b + 1}: |V|=${m.visibility.amplitude.toFixed(3)}  arg(V)=${m.visibility.phase.toFixed(3)} rad`, pad.left, height - 18);
}

function drawUv(m) {
  const { ctx, width, height } = setup(document.getElementById("uvCanvas"));
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, width, height);
  const pad = { left: 58, right: 24, top: 24, bottom: 42 };
  const limit = m.maxUv * 1.12;
  const sx = (u) => pad.left + ((u + limit) / (2 * limit)) * (width - pad.left - pad.right);
  const sy = (v) => height - pad.bottom - ((v + limit) / (2 * limit)) * (height - pad.top - pad.bottom);
  drawGrid(ctx, width, height, pad, "u (lambda)", "v (lambda)");
  ctx.strokeStyle = "rgba(255,255,255,.35)";
  ctx.beginPath();
  ctx.moveTo(sx(-limit), sy(0));
  ctx.lineTo(sx(limit), sy(0));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sx(0), sy(-limit));
  ctx.lineTo(sx(0), sy(limit));
  ctx.stroke();
  const drawTrack = (track, sign, colour, widthPx) => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = widthPx;
    ctx.beginPath();
    track.forEach((point, index) => {
      const x = sx(sign * point.u);
      const y = sy(sign * point.v);
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };
  m.tracks.forEach((track) => {
    drawTrack(track, 1, "rgba(91,216,255,.74)", 1.5);
    drawTrack(track, -1, "rgba(91,216,255,.26)", 1.0);
  });
  ctx.fillStyle = "#ffb45c";
  ctx.beginPath();
  ctx.arc(sx(m.selected.u), sy(m.selected.v), 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#aab2c0";
  ctx.font = "12px system-ui";
  ctx.fillText(`${m.array.name}: ${m.pairs.length} tracks, plus Hermitian counterparts; +/-${val("trackHours").toFixed(1)} h`, pad.left, height - 16);
}

function pixelColour(value) {
  const t = Math.max(-1, Math.min(1, value));
  return t >= 0
    ? [Math.round(18 + 235 * t), Math.round(24 + 185 * t), Math.round(42 + 190 * t)]
    : [Math.round(35 + 120 * (1 + t)), Math.round(22 + 75 * (1 + t)), Math.round(70 + 140 * (1 + t))];
}

function drawVisibilityAndBeam(m) {
  const { ctx, width, height } = setup(document.getElementById("visibilityCanvas"));
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, width, height);
  const split = width * 0.57;
  const pad = { left: 48, right: 18, top: 28, bottom: 40 };
  const selectedLength = Math.max(m.selected.length, 1e-12);
  const maxBaseline = Math.max(10, selectedLength * 1.5);
  const px = (baseline) => pad.left + (baseline / maxBaseline) * (split - pad.left - pad.right);
  const py = (amplitude) => height - pad.bottom - amplitude * (height - pad.top - pad.bottom);
  ctx.strokeStyle = "rgba(255,255,255,.10)";
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (height - pad.top - pad.bottom) * i / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(split - pad.right, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#5bd8ff";
  ctx.lineWidth = 2.3;
  ctx.beginPath();
  for (let i = 0; i <= 220; i += 1) {
    const scale = i / 220;
    const visibility = binaryVisibility(m.selected.u * scale * maxBaseline / selectedLength, m.selected.v * scale * maxBaseline / selectedLength, m.separationMas, m.positionAngle, m.fluxRatio);
    const x = px(maxBaseline * scale);
    const y = py(visibility.amplitude);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = "#ffb45c";
  ctx.beginPath();
  ctx.arc(px(selectedLength), py(m.visibility.amplitude), 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#aab2c0";
  ctx.font = "12px system-ui";
  ctx.fillText("selected-baseline binary visibility", pad.left, 18);
  ctx.fillText("baseline length (m)", split - 130, height - 14);

  const responseGrid = 128;
  const image = ctx.createImageData(responseGrid, responseGrid);
  const samplePoints = m.tracks.flatMap((track) => track.filter((_, index) => index % 4 === 0));
  const fieldRad = 5.5 / m.maxUv;
  for (let y = 0; y < responseGrid; y += 1) {
    const directionM = fieldRad * (1 - 2 * (y + 0.5) / responseGrid);
    for (let x = 0; x < responseGrid; x += 1) {
      const directionL = fieldRad * (2 * (x + 0.5) / responseGrid - 1);
      let response = 0;
      for (const point of samplePoints) response += Math.cos(2 * Math.PI * (point.u * directionL + point.v * directionM));
      const [r, g, b] = pixelColour(response / Math.max(1, samplePoints.length));
      const index = 4 * (y * responseGrid + x);
      image.data[index] = r;
      image.data[index + 1] = g;
      image.data[index + 2] = b;
      image.data[index + 3] = 255;
    }
  }
  const raw = document.createElement("canvas");
  raw.width = responseGrid;
  raw.height = responseGrid;
  raw.getContext("2d").putImageData(image, 0, 0);
  const size = Math.min(height - 48, width - split - 26);
  const x0 = split + (width - split - size) / 2;
  const y0 = 24;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(raw, x0, y0, size, size);
  ctx.strokeStyle = "rgba(255,255,255,.4)";
  ctx.strokeRect(x0, y0, size, size);
  ctx.fillStyle = "#aab2c0";
  ctx.fillText("natural-weighted sampling response", x0, 18);
  ctx.fillText(`+/- ${masFromRad(fieldRad).toFixed(2)} mas`, x0, height - 14);
}

function updateScenarioCopy() {
  const scenario = activeScenario();
  const array = activeArray();
  label.scenarioName.textContent = scenario.name;
  label.scenarioNote.textContent = scenario.note;
  label.arrayName.textContent = array.description;
}

function render() {
  const m = model();
  updateScenarioCopy();
  label.baseline.textContent = formatDistance(m.scale);
  label.wavelength.textContent = formatWavelength(m.wavelengthUm);
  label.separation.textContent = `${m.separationMas.toFixed(1)} mas`;
  label.positionAngle.textContent = `${val("positionAngle").toFixed(0)} deg`;
  label.fluxRatio.textContent = m.fluxRatio.toFixed(2);
  label.hour.textContent = `${(val("hour") / 15).toFixed(1)} h`;
  label.dec.textContent = `${val("dec").toFixed(0)} deg`;
  label.trackHours.textContent = `+/- ${val("trackHours").toFixed(1)} h`;
  label.resolution.textContent = `${m.resolutionMas.toFixed(3)} mas`;
  label.fringe.textContent = `${m.resolutionMas.toFixed(3)} mas`;
  label.projected.textContent = formatDistance(m.selected.projected);
  label.baselines.textContent = `${m.pairs.length} pairs`;
  label.spatialFrequency.textContent = formatMlambda(Math.hypot(m.selected.u, m.selected.v));
  label.visibilityAmp.textContent = m.visibility.amplitude.toFixed(3);
  label.visibilityPhase.textContent = `${m.visibility.phase.toFixed(3)} rad`;
  label.u.textContent = formatMlambda(m.selected.u);
  label.v.textContent = formatMlambda(m.selected.v);
  label.w.textContent = formatMlambda(m.selected.w);
  drawArrayLayout(m);
  drawFringes(m);
  drawUv(m);
  drawVisibilityAndBeam(m);
}

function loadScenario(key) {
  const scenario = SCENARIOS[key] ?? SCENARIOS.custom;
  control.baseline.value = String(scenario.baseline);
  control.wavelength.value = String(scenario.wavelength);
  control.hour.value = String(scenario.hour);
  control.dec.value = String(scenario.dec);
  control.trackHours.value = String(scenario.trackHours);
  arraySelect.value = scenario.array;
  render();
}

scenarioSelect.addEventListener("change", () => loadScenario(scenarioSelect.value));
arraySelect.addEventListener("change", () => {
  if (scenarioSelect.value !== "custom") scenarioSelect.value = "custom";
  render();
});
controlIds.forEach((id) => control[id].addEventListener("input", () => {
  if (scenarioSelect.value !== "custom") scenarioSelect.value = "custom";
  render();
}));
window.addEventListener("resize", render);
render();
