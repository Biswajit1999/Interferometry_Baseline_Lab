(() => {
  "use strict";

  const defaults = {
    day: "101",
    band: "hi",
    modelOverlay: false,
    playback: 120,
    fov: 160,
    ringDiameter: 42,
    ringWidth: 9,
    asymmetry: 0.55,
    positionAngle: 38,
  };
  const controls = Object.fromEntries(Object.keys(defaults).map((id) => [id, document.getElementById(id)]));
  const readout = {
    engineLight: document.getElementById("engine-light"),
    engine: document.getElementById("engine"),
    utc: document.getElementById("utc"),
    hourAngle: document.getElementById("hour-angle"),
    fps: document.getElementById("fps"),
    baselines: document.getElementById("baselines"),
    uvSamples: document.getElementById("uv-samples"),
    maxUv: document.getElementById("max-uv"),
    beam: document.getElementById("beam"),
    compute: document.getElementById("compute"),
    log: document.getElementById("log"),
    status: document.getElementById("status"),
  };
  const buttons = {
    run: document.getElementById("run"),
    restart: document.getElementById("restart"),
    export: document.getElementById("export"),
  };

  class Canvas {
    constructor(id) {
      this.canvas = document.getElementById(id);
      this.context = this.canvas.getContext("2d", { alpha: false, desynchronized: true });
    }

    start() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = this.canvas.getBoundingClientRect();
      const width = Math.max(10, Math.round(rect.width));
      const height = Math.max(10, Math.round(rect.height));
      this.canvas.width = Math.round(width * ratio);
      this.canvas.height = Math.round(height * ratio);
      this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
      this.context.fillStyle = "#080d16";
      this.context.fillRect(0, 0, width, height);
      return { ctx: this.context, width, height };
    }
  }

  const canvas = {
    uv: new Canvas("uv"),
    beam: new Canvas("beam-map"),
    dirty: new Canvas("dirty"),
    truth: new Canvas("truth"),
    visibility: new Canvas("visibility"),
  };
  const state = {
    worker: null,
    requestTimer: 0,
    running: true,
    frame: null,
    logs: [],
    frames: 0,
    fpsStarted: performance.now(),
  };

  function value(id) {
    if (controls[id].type === "checkbox") return controls[id].checked;
    return controls[id].type === "select-one" ? controls[id].value : Number(controls[id].value);
  }

  function updateLabels() {
    const days = { "095": "APR 05 / DOY 095", "096": "APR 06 / DOY 096", "100": "APR 10 / DOY 100", "101": "APR 11 / DOY 101" };
    document.getElementById("day-value").textContent = days[value("day")];
    document.getElementById("band-value").textContent = value("band").toUpperCase();
    document.getElementById("modelOverlay-value").textContent = value("modelOverlay") ? "ON" : "OFF";
    document.getElementById("playback-value").textContent = `${value("playback").toFixed(0)} sample/s`;
    document.getElementById("fov-value").textContent = `${value("fov").toFixed(0)} uas`;
    document.getElementById("ringDiameter-value").textContent = `${value("ringDiameter").toFixed(1)} uas`;
    document.getElementById("ringWidth-value").textContent = `${value("ringWidth").toFixed(1)} uas`;
    document.getElementById("asymmetry-value").textContent = value("asymmetry").toFixed(2);
    document.getElementById("positionAngle-value").textContent = `${value("positionAngle").toFixed(0)} deg`;
    document.querySelectorAll(".model-parameters").forEach((element) => {
      element.classList.toggle("active", value("modelOverlay"));
    });
  }

  function parameters() {
    return Object.fromEntries(Object.keys(defaults).map((id) => [id, value(id)]));
  }

  function engine(name, className, status) {
    readout.engine.textContent = name;
    readout.engineLight.className = className;
    readout.status.textContent = status;
  }

  function log(message) {
    state.logs.unshift(`${new Date().toISOString().slice(11, 19)}  ${message}`);
    state.logs.length = Math.min(state.logs.length, 7);
    readout.log.replaceChildren(...state.logs.map((line) => {
      const item = document.createElement("li");
      item.textContent = line;
      return item;
    }));
  }

  function configure(immediate = false) {
    updateLabels();
    if (!state.worker) return;
    clearTimeout(state.requestTimer);
    const send = () => {
      engine("LOADING", "busy", "RETRIEVING EHT CALIBRATED VISIBILITIES");
      state.worker.postMessage({ type: "configure", parameters: parameters() });
    };
    if (immediate) send(); else state.requestTimer = setTimeout(send, 45);
  }

  function imagePlot(surface, bytes, size, emptyMessage = "") {
    const { ctx, width, height } = surface.start();
    const scratch = document.createElement("canvas");
    scratch.width = size;
    scratch.height = size;
    scratch.getContext("2d").putImageData(new ImageData(bytes, size, size), 0, 0);
    const side = Math.min(width, height) - 24;
    const left = (width - side) / 2;
    const top = (height - side) / 2;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(scratch, left, top, side, side);
    ctx.imageSmoothingEnabled = true;
    ctx.strokeStyle = "rgba(129,150,173,.5)";
    ctx.strokeRect(left, top, side, side);
    if (emptyMessage) {
      ctx.fillStyle = "#8196ad";
      ctx.font = '10px "Roboto Mono", Consolas, monospace';
      ctx.textAlign = "center";
      ctx.fillText(emptyMessage, width / 2, height / 2);
      ctx.textAlign = "left";
    }
  }

  function drawUv(frame) {
    const { ctx, width, height } = canvas.uv.start();
    const side = Math.min(width, height) - 45;
    const centreX = width / 2;
    const centreY = height / 2;
    ctx.strokeStyle = "rgba(129,150,173,.32)";
    ctx.beginPath();
    ctx.moveTo(centreX - side / 2, centreY);
    ctx.lineTo(centreX + side / 2, centreY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(centreX, centreY - side / 2);
    ctx.lineTo(centreX, centreY + side / 2);
    ctx.stroke();
    ctx.fillStyle = "#34d7e5";
    for (let index = 0; index < frame.uv.length; index += 2) {
      ctx.fillRect(centreX + frame.uv[index] * side / 2 - 1, centreY - frame.uv[index + 1] * side / 2 - 1, 2.3, 2.3);
    }
    ctx.fillStyle = "#8196ad";
    ctx.font = '10px "Roboto Mono", Consolas, monospace';
    ctx.fillText("-u", centreX - side / 2, centreY + 17);
    ctx.textAlign = "right";
    ctx.fillText("+u", centreX + side / 2, centreY + 17);
    ctx.textAlign = "left";
    ctx.fillText("+v", centreX + 8, centreY - side / 2 + 10);
  }

  function drawVisibility(frame) {
    const { ctx, width, height } = canvas.visibility.start();
    const box = { left: 58, top: 12, w: width - 75, h: height - 38 };
    ctx.strokeStyle = "rgba(129,150,173,.25)";
    for (let tick = 0; tick <= 4; tick += 1) {
      const y = box.top + box.h * tick / 4;
      ctx.beginPath();
      ctx.moveTo(box.left, y);
      ctx.lineTo(box.left + box.w, y);
      ctx.stroke();
    }
    ctx.fillStyle = "#8196ad";
    ctx.font = '10px "Roboto Mono", Consolas, monospace';
    ctx.fillText("|V| Jy", 8, box.top + 7);
    ctx.textAlign = "right";
    ctx.fillText("UTC HOURS", width - 12, height - 8);
    ctx.textAlign = "left";
    if (frame.visibility.amplitudes.length === 0) return;
    const values = frame.telemetry;
    const timeSpan = values.timeMaximumHours - values.timeMinimumHours || 1;
    const maximum = values.maximumAmplitudeJy || 1;
    ctx.strokeStyle = "#ffbc57";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let index = 0; index < frame.visibility.amplitudes.length; index += 1) {
      const x = box.left + (frame.visibility.times[index] - values.timeMinimumHours) / timeSpan * box.w;
      const y = box.top + (1 - frame.visibility.amplitudes[index] / maximum) * box.h;
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillText(`${maximum.toFixed(2)} Jy`, box.left + 5, box.top + 13);
  }

  function handle(message) {
    if (message.type === "loading") {
      log(message.message);
    } else if (message.type === "dataError") {
      engine("FAILED", "failed", "EHT DATA LOAD FAILED");
      log(message.message);
    } else if (message.type === "frame") {
      state.frame = message;
      const values = message.telemetry;
      readout.hourAngle.textContent = `${values.currentUtcHours.toFixed(3)} h`;
      readout.baselines.textContent = values.baselines.toFixed(0);
      readout.uvSamples.textContent = `${values.uvSamples.toFixed(0)} / ${values.totalRecords * 2}`;
      readout.maxUv.textContent = `${values.maximumUv.toExponential(3)} lambda`;
      readout.beam.textContent = `${values.beamMicroarcsec.toFixed(2)} uas`;
      readout.compute.textContent = `${values.computeMilliseconds.toFixed(2)} ms`;
      drawUv(message);
      imagePlot(canvas.beam, message.dirtyBeam, message.imageSize);
      imagePlot(canvas.dirty, message.dirtyImage, message.imageSize);
      imagePlot(canvas.truth, message.truth, message.imageSize, values.modelEnabled ? "" : "ENABLE MODEL REFERENCE");
      drawVisibility(message);
      engine("ONLINE", "online", `EHT IFFT CURRENT / ${values.activeRecords} RECORDS`);
    } else if (message.type === "csv") {
      const url = URL.createObjectURL(new Blob([message.content], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = message.filename;
      link.click();
      URL.revokeObjectURL(url);
      log(`Exported ${message.rows} measured EHT visibility records`);
    }
  }

  function start() {
    updateLabels();
    readout.utc.textContent = new Date().toISOString().slice(11, 19);
    setInterval(() => {
      readout.utc.textContent = new Date().toISOString().slice(11, 19);
    }, 1000);
    try {
      state.worker = new Worker("assets/js/physicsWorker.js");
      state.worker.addEventListener("message", (event) => handle(event.data));
      state.worker.addEventListener("error", (event) => {
        engine("FAILED", "failed", "WORKER FAILURE");
        log(event.message);
      });
      configure(true);
      log("Loading EHT released visibility product");
    } catch (error) {
      engine("FAILED", "failed", "SERVE APPLICATION OVER HTTP");
      log(error.message);
    }
    const animate = (timestamp) => {
      state.frames += 1;
      if (timestamp - state.fpsStarted >= 1000) {
        readout.fps.textContent = `${(state.frames * 1000 / (timestamp - state.fpsStarted)).toFixed(0)} FPS`;
        state.frames = 0;
        state.fpsStarted = timestamp;
      }
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  Object.values(controls).forEach((control) => {
    control.addEventListener("input", () => configure(false));
    control.addEventListener("change", () => configure(true));
  });
  buttons.run.addEventListener("click", () => {
    state.running = !state.running;
    buttons.run.textContent = state.running ? "PAUSE TRACK" : "RESUME TRACK";
    buttons.run.classList.toggle("on", state.running);
    state.worker?.postMessage({ type: "setRunning", running: state.running });
    log(state.running ? "Observed visibility playback resumed" : "Observed visibility playback paused");
  });
  buttons.restart.addEventListener("click", () => {
    state.worker?.postMessage({ type: "restart" });
    log("EHT record progression restarted");
  });
  buttons.export.addEventListener("click", () => state.worker?.postMessage({ type: "exportUv" }));
  window.addEventListener("resize", () => {
    if (state.frame) handle(state.frame);
  });
  start();
})();
