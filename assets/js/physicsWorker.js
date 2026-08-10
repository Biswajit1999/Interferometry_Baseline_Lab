"use strict";

const IMAGE_SIZE = 128;
const RADIANS_TO_MICROARCSEC = 206264806247.09636;
const FRAME_MS = 90;
const RELEASE_ROOT =
  "https://raw.githubusercontent.com/eventhorizontelescope/2019-D01-01/master/csv/";
const LOCAL_RELEASE_ROOT = "../../data/observations/";

const runtime = {
  parameters: null,
  observations: null,
  cache: new Map(),
  progress: 0,
  running: true,
  timer: null,
  currentSamples: [],
  requestToken: 0,
};

self.addEventListener("message", (event) => {
  const message = event.data;
  if (message.type === "configure") {
    void configure(message.parameters);
  } else if (message.type === "setRunning") {
    runtime.running = Boolean(message.running);
    ensureTimer();
    if (runtime.observations) emitFrame();
  } else if (message.type === "restart") {
    runtime.progress = 0;
    if (runtime.observations) emitFrame();
  } else if (message.type === "exportUv") {
    exportUv();
  }
});

async function configure(raw) {
  runtime.parameters = sanitise(raw);
  runtime.progress = 0;
  const key = `${runtime.parameters.day}_${runtime.parameters.band}`;
  const token = ++runtime.requestToken;
  try {
    self.postMessage({ type: "loading", message: `Retrieving EHT M87 DOY ${runtime.parameters.day} ${runtime.parameters.band.toUpperCase()} visibilities` });
    const observations = await loadRelease(key);
    if (token !== runtime.requestToken) return;
    runtime.observations = observations;
    emitFrame();
    ensureTimer();
  } catch (error) {
    self.postMessage({ type: "dataError", message: `Unable to load official EHT visibility data: ${error.message}` });
  }
}

function sanitise(raw) {
  return {
    day: ["095", "096", "100", "101"].includes(String(raw.day)) ? String(raw.day) : "101",
    band: raw.band === "lo" ? "lo" : "hi",
    modelOverlay: Boolean(raw.modelOverlay),
    playbackSamplesPerSecond: clamp(number(raw.playback, 120), 1, 5000),
    fieldMicroarcsec: clamp(number(raw.fov, 160), 20, 1000),
    ringDiameterMicroarcsec: clamp(number(raw.ringDiameter, 42), 1, 500),
    ringWidthMicroarcsec: clamp(number(raw.ringWidth, 9), 0.2, 200),
    asymmetry: clamp(number(raw.asymmetry, 0.55), 0, 0.99),
    positionAngleRadians: number(raw.positionAngle, 38) * Math.PI / 180,
  };
}

async function loadRelease(key) {
  if (runtime.cache.has(key)) return runtime.cache.get(key);
  const filename = `SR1_M87_2017_${key}_hops_netcal_StokesI.csv`;
  let response = await fetch(`${LOCAL_RELEASE_ROOT}${filename}`);
  if (!response.ok) {
    response = await fetch(`${RELEASE_ROOT}${filename}`);
  }
  if (!response.ok) throw new Error(`EHT HTTP ${response.status}`);
  const observations = parseVisibilityCsv(await response.text());
  if (observations.length < 10) throw new Error(`unexpected visibility record count ${observations.length}`);
  observations.filename = filename;
  runtime.cache.set(key, observations);
  return observations;
}

function parseVisibilityCsv(text) {
  const records = [];
  for (const line of text.split(/\r?\n/)) {
    const stripped = line.trim();
    if (!stripped || stripped.startsWith("#")) continue;
    const columns = stripped.replace(/,/g, " ").split(/\s+/);
    if (columns.length < 8) continue;
    const timeHours = Number(columns[0]);
    const u = Number(columns[3]);
    const v = Number(columns[4]);
    const amplitudeJy = Number(columns[5]);
    const phaseDegrees = Number(columns[6]);
    const sigmaJy = Number(columns[7]);
    if (![timeHours, u, v, amplitudeJy, phaseDegrees, sigmaJy].every(Number.isFinite)) continue;
    const phase = phaseDegrees * Math.PI / 180;
    records.push({
      timeHours,
      baseline: `${columns[1]}-${columns[2]}`,
      u,
      v,
      amplitudeJy,
      phaseDegrees,
      sigmaJy,
      real: amplitudeJy * Math.cos(phase),
      imaginary: amplitudeJy * Math.sin(phase),
    });
  }
  return records.sort((first, second) => first.timeHours - second.timeHours);
}

function ensureTimer() {
  if (runtime.timer === null) {
    runtime.timer = self.setInterval(() => {
      if (!runtime.running || !runtime.observations || !runtime.parameters) return;
      const increment = runtime.parameters.playbackSamplesPerSecond * FRAME_MS / 1000 /
        runtime.observations.length;
      runtime.progress = (runtime.progress + increment) % 1;
      emitFrame();
    }, FRAME_MS);
  }
}

function emitFrame() {
  if (!runtime.parameters || !runtime.observations) return;
  const start = performance.now();
  const data = runtime.observations;
  const activeCount = Math.max(1, Math.floor(runtime.progress * (data.length - 1)) + 1);
  const active = data.slice(0, activeCount);
  const maximumUv = determineMaximumUv(data);
  const visibilityReal = new Float64Array(IMAGE_SIZE * IMAGE_SIZE);
  const visibilityImaginary = new Float64Array(IMAGE_SIZE * IMAGE_SIZE);
  const weights = new Float64Array(IMAGE_SIZE * IMAGE_SIZE);
  const uvCoordinates = new Float32Array(active.length * 4);
  const amplitudes = new Float32Array(active.length);
  const times = new Float32Array(active.length);
  const baselines = new Set();
  let maximumAmplitudeJy = 0;
  runtime.currentSamples = active;

  for (let index = 0; index < active.length; index += 1) {
    const visibility = active[index];
    baselines.add(visibility.baseline);
    maximumAmplitudeJy = Math.max(maximumAmplitudeJy, visibility.amplitudeJy);
    gridSample(visibilityReal, visibilityImaginary, weights, visibility.u, visibility.v, visibility, maximumUv);
    gridSample(
      visibilityReal,
      visibilityImaginary,
      weights,
      -visibility.u,
      -visibility.v,
      { real: visibility.real, imaginary: -visibility.imaginary },
      maximumUv
    );
    uvCoordinates[index * 4] = visibility.u / maximumUv;
    uvCoordinates[index * 4 + 1] = visibility.v / maximumUv;
    uvCoordinates[index * 4 + 2] = -visibility.u / maximumUv;
    uvCoordinates[index * 4 + 3] = -visibility.v / maximumUv;
    amplitudes[index] = visibility.amplitudeJy;
    times[index] = visibility.timeHours;
  }

  const dirtyImage = inverseImage(visibilityReal, visibilityImaginary);
  const dirtyBeam = inverseImage(weights, new Float64Array(weights.length));
  const reference = runtime.parameters.modelOverlay
    ? ringReference(runtime.parameters)
    : new Float64Array(IMAGE_SIZE * IMAGE_SIZE);
  const message = {
    type: "frame",
    telemetry: {
      filename: data.filename,
      baselines: baselines.size,
      uvSamples: active.length * 2,
      totalRecords: data.length,
      maximumUv,
      beamMicroarcsec: RADIANS_TO_MICROARCSEC / maximumUv,
      currentUtcHours: active[active.length - 1].timeHours,
      timeMinimumHours: data[0].timeHours,
      timeMaximumHours: data[data.length - 1].timeHours,
      maximumAmplitudeJy,
      computeMilliseconds: performance.now() - start,
      progress: runtime.progress,
      activeRecords: active.length,
      modelEnabled: runtime.parameters.modelOverlay,
    },
    uv: uvCoordinates,
    dirtyImage: colourImage(dirtyImage, false),
    dirtyBeam: colourImage(dirtyBeam, false),
    truth: colourImage(reference, true),
    imageSize: IMAGE_SIZE,
    visibility: { times, amplitudes },
  };
  self.postMessage(message, [
    uvCoordinates.buffer,
    message.dirtyImage.buffer,
    message.dirtyBeam.buffer,
    message.truth.buffer,
    times.buffer,
    amplitudes.buffer,
  ]);
}

function determineMaximumUv(records) {
  let maximum = 1;
  for (const record of records) maximum = Math.max(maximum, Math.abs(record.u), Math.abs(record.v));
  return maximum * 1.05;
}

function gridSample(real, imaginary, weights, u, v, visibility, maximumUv) {
  const half = IMAGE_SIZE / 2 - 2;
  const x = Math.round(IMAGE_SIZE / 2 + u / maximumUv * half);
  const y = Math.round(IMAGE_SIZE / 2 + v / maximumUv * half);
  if (x < 0 || x >= IMAGE_SIZE || y < 0 || y >= IMAGE_SIZE) return;
  const pixel = y * IMAGE_SIZE + x;
  real[pixel] += visibility.real;
  imaginary[pixel] += visibility.imaginary;
  weights[pixel] += 1;
}

function inverseImage(centredReal, centredImaginary) {
  const real = new Float64Array(centredReal.length);
  const imaginary = new Float64Array(centredImaginary.length);
  for (let y = 0; y < IMAGE_SIZE; y += 1) {
    for (let x = 0; x < IMAGE_SIZE; x += 1) {
      const shiftedX = (x + IMAGE_SIZE / 2) % IMAGE_SIZE;
      const shiftedY = (y + IMAGE_SIZE / 2) % IMAGE_SIZE;
      const source = y * IMAGE_SIZE + x;
      const target = shiftedY * IMAGE_SIZE + shiftedX;
      real[target] = centredReal[source];
      imaginary[target] = centredImaginary[source];
    }
  }
  fft2d(real, imaginary, true);
  const output = new Float64Array(real.length);
  for (let y = 0; y < IMAGE_SIZE; y += 1) {
    for (let x = 0; x < IMAGE_SIZE; x += 1) {
      const shiftedX = (x + IMAGE_SIZE / 2) % IMAGE_SIZE;
      const shiftedY = (y + IMAGE_SIZE / 2) % IMAGE_SIZE;
      output[shiftedY * IMAGE_SIZE + shiftedX] = real[y * IMAGE_SIZE + x];
    }
  }
  return output;
}

function ringReference(parameters) {
  const image = new Float64Array(IMAGE_SIZE * IMAGE_SIZE);
  const radius = parameters.ringDiameterMicroarcsec / 2;
  const sigma = parameters.ringWidthMicroarcsec / (2 * Math.sqrt(2 * Math.log(2)));
  for (let y = 0; y < IMAGE_SIZE; y += 1) {
    const coordinateY = (0.5 - (y + 0.5) / IMAGE_SIZE) * parameters.fieldMicroarcsec;
    for (let x = 0; x < IMAGE_SIZE; x += 1) {
      const coordinateX = ((x + 0.5) / IMAGE_SIZE - 0.5) * parameters.fieldMicroarcsec;
      const radial = Math.hypot(coordinateX, coordinateY);
      const angle = Math.atan2(coordinateY, coordinateX);
      const annulus = Math.exp(-0.5 * ((radial - radius) / sigma) ** 2);
      const brightSide = 1 + parameters.asymmetry * Math.cos(angle - parameters.positionAngleRadians);
      image[y * IMAGE_SIZE + x] = annulus * Math.max(0, brightSide);
    }
  }
  return image;
}

function colourImage(values, positiveOnly) {
  let maximum = 0;
  for (const value of values) maximum = Math.max(maximum, Math.abs(value));
  const rgba = new Uint8ClampedArray(values.length * 4);
  for (let index = 0; index < values.length; index += 1) {
    const scaled = maximum === 0 ? 0 : values[index] / maximum;
    if (positiveOnly) heatColour(clamp(scaled, 0, 1), rgba, index * 4);
    else divergentColour(clamp(scaled, -1, 1), rgba, index * 4);
  }
  return rgba;
}

function divergentColour(value, rgba, offset) {
  const magnitude = Math.abs(value);
  if (value < 0) {
    rgba[offset] = Math.round(10 + 22 * magnitude);
    rgba[offset + 1] = Math.round(18 + 136 * magnitude);
    rgba[offset + 2] = Math.round(31 + 206 * magnitude);
  } else {
    rgba[offset] = Math.round(10 + 245 * magnitude);
    rgba[offset + 1] = Math.round(18 + 157 * magnitude);
    rgba[offset + 2] = Math.round(31 + 52 * magnitude);
  }
  rgba[offset + 3] = 255;
}

function heatColour(value, rgba, offset) {
  rgba[offset] = Math.round(8 + 247 * value);
  rgba[offset + 1] = Math.round(12 + 202 * Math.sqrt(value));
  rgba[offset + 2] = Math.round(22 + 112 * (1 - value));
  rgba[offset + 3] = 255;
}

function fft2d(real, imaginary, inverse) {
  const rowReal = new Float64Array(IMAGE_SIZE);
  const rowImaginary = new Float64Array(IMAGE_SIZE);
  for (let y = 0; y < IMAGE_SIZE; y += 1) {
    for (let x = 0; x < IMAGE_SIZE; x += 1) {
      rowReal[x] = real[y * IMAGE_SIZE + x];
      rowImaginary[x] = imaginary[y * IMAGE_SIZE + x];
    }
    fft(rowReal, rowImaginary, inverse);
    for (let x = 0; x < IMAGE_SIZE; x += 1) {
      real[y * IMAGE_SIZE + x] = rowReal[x];
      imaginary[y * IMAGE_SIZE + x] = rowImaginary[x];
    }
  }
  const columnReal = new Float64Array(IMAGE_SIZE);
  const columnImaginary = new Float64Array(IMAGE_SIZE);
  for (let x = 0; x < IMAGE_SIZE; x += 1) {
    for (let y = 0; y < IMAGE_SIZE; y += 1) {
      columnReal[y] = real[y * IMAGE_SIZE + x];
      columnImaginary[y] = imaginary[y * IMAGE_SIZE + x];
    }
    fft(columnReal, columnImaginary, inverse);
    for (let y = 0; y < IMAGE_SIZE; y += 1) {
      real[y * IMAGE_SIZE + x] = columnReal[y];
      imaginary[y * IMAGE_SIZE + x] = columnImaginary[y];
    }
  }
}

function fft(real, imaginary, inverse) {
  const length = real.length;
  let reversed = 0;
  for (let index = 1; index < length; index += 1) {
    let bit = length >> 1;
    while (reversed & bit) {
      reversed ^= bit;
      bit >>= 1;
    }
    reversed ^= bit;
    if (index < reversed) {
      [real[index], real[reversed]] = [real[reversed], real[index]];
      [imaginary[index], imaginary[reversed]] = [imaginary[reversed], imaginary[index]];
    }
  }
  const direction = inverse ? 1 : -1;
  for (let size = 2; size <= length; size <<= 1) {
    const angle = direction * 2 * Math.PI / size;
    const rotationReal = Math.cos(angle);
    const rotationImaginary = Math.sin(angle);
    for (let start = 0; start < length; start += size) {
      let unitReal = 1;
      let unitImaginary = 0;
      for (let offset = 0; offset < size / 2; offset += 1) {
        const even = start + offset;
        const odd = even + size / 2;
        const transformedReal = unitReal * real[odd] - unitImaginary * imaginary[odd];
        const transformedImaginary = unitReal * imaginary[odd] + unitImaginary * real[odd];
        real[odd] = real[even] - transformedReal;
        imaginary[odd] = imaginary[even] - transformedImaginary;
        real[even] += transformedReal;
        imaginary[even] += transformedImaginary;
        const nextReal = unitReal * rotationReal - unitImaginary * rotationImaginary;
        unitImaginary = unitReal * rotationImaginary + unitImaginary * rotationReal;
        unitReal = nextReal;
      }
    }
  }
  if (inverse) {
    for (let index = 0; index < length; index += 1) {
      real[index] /= length;
      imaginary[index] /= length;
    }
  }
}

function exportUv() {
  if (!runtime.currentSamples.length) return;
  const rows = ["utc_hours,baseline,u_wavelengths,v_wavelengths,stokes_i_amplitude_jy,stokes_i_phase_deg,stokes_i_sigma_jy,visibility_real_jy,visibility_imaginary_jy"];
  for (const sample of runtime.currentSamples) {
    rows.push([
      sample.timeHours.toFixed(8),
      sample.baseline,
      sample.u.toFixed(4),
      sample.v.toFixed(4),
      sample.amplitudeJy.toFixed(8),
      sample.phaseDegrees.toFixed(6),
      sample.sigmaJy.toFixed(8),
      sample.real.toFixed(10),
      sample.imaginary.toFixed(10),
    ].join(","));
  }
  self.postMessage({
    type: "csv",
    filename: "eht_m87_observed_complex_visibilities.csv",
    rows: runtime.currentSamples.length,
    content: `${rows.join("\n")}\n`,
  });
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function number(value, fallback) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}
