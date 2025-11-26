// Pass 8 rebuild - main.js

let hasToken = false;
let displayOn = false;
let analysisRunning = false;
let fanOn = false;
let soundEnabled = false;

let irisState = "OFF"; // OFF, STAGE1, STAGE2, STAGE3, ACTIVE
let irisTargetActive = false;
let irisBlink = false;
let irisBlinkTimer = 0;
let irisStepTimer = 0;

let mediaStream = null;
let audioContext = null;
let analyserNode = null;
let audioDataArray = null;
let lastRms = 0;
let lastStress = 0;

// Firmware
let currentFirmware = null;

// Speech recognition
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let srActive = false;

// DOM references
const slotFan = document.getElementById("slotFan");
const slotIris = document.getElementById("slotIris");
const slotAudio = document.getElementById("slotAudio");
const slotVideo = document.getElementById("slotVideo");
const slotProfile = document.getElementById("slotProfile");
const slotStatus = document.getElementById("slotStatus");
const line2Text = document.getElementById("line2Text");

const actK = document.getElementById("actK");
const actD = document.getElementById("actD");
const actF = document.getElementById("actF");
const actI = document.getElementById("actI");
const actSpace = document.getElementById("actSpace");
const actL = document.getElementById("actL");
const actW = document.getElementById("actW");
const actV = document.getElementById("actV");
const actS = document.getElementById("actS");

const logWindow = document.getElementById("logWindow");
const w3sWindow = document.getElementById("w3sWindow");
const vuWindow = document.getElementById("vuWindow");
const sysWindow = document.getElementById("sysWindow");
const logContent = document.getElementById("logContent");

const irisVideo = document.getElementById("irisVideo");
const irisBars = document.getElementById("irisBars");
const irisPlaceholder = document.getElementById("irisPlaceholder");
const voiceCanvas = document.getElementById("voiceCanvas");
const nexusCanvas = document.getElementById("nexusCanvas");
const voicePlaceholder = document.getElementById("voicePlaceholder");
const nexusPlaceholder = document.getElementById("nexusPlaceholder");

const themeRoot = document.getElementById("themeRoot");
const applyThemeBtn = document.getElementById("applyThemeBtn");
const profileCodeText = document.getElementById("profileCodeText");
const romStatusText = document.getElementById("romStatusText");
const sysCurrentROM = document.getElementById("sysCurrentROM");
const firmwareProgress = document.getElementById("firmwareProgress");
const firmwareStatus = document.getElementById("firmwareStatus");

const vuHorizontal = document.getElementById("vuHorizontal");
const vuVertical = document.getElementById("vuVertical");

// --- Logging / status ---

const logBuffer = [];
const LOG_LIMIT = 500;

function logEvent(msg) {
  const ts = new Date().toISOString().substr(11, 8);
  const line = `[${ts}] ${msg}`;
  logBuffer.push(line);
  if (logBuffer.length > LOG_LIMIT) logBuffer.shift();
  if (logContent) {
    logContent.textContent = logBuffer.join("\n");
    logContent.scrollTop = logContent.scrollHeight;
  }
}

function setStatus(text) {
  const maxLen = 40;
  let t = text || "";
  if (t.length > maxLen) t = t.slice(0, maxLen - 1) + "…";
  slotStatus.textContent = ("STATUS: " + t).padEnd(40, " ");
  logEvent("STATUS: " + text);
}

// --- Footer helpers ---

function irisDisplayText() {
  switch (irisState) {
    case "OFF": return "   ";
    case "STAGE1": return "***";
    case "STAGE2": return "** ";
    case "STAGE3": return " * ";
    case "ACTIVE": return irisBlink ? "  *" : "   ";
    default: return "   ";
  }
}

function updateFooterLine1() {
  // fan
  slotFan.textContent = ("FAN:" + " ").padEnd(12, " ");

  // iris
  const irisLabel = "IRIS:";
  const irisVal = irisDisplayText();
  slotIris.textContent = (irisLabel + " " + irisVal).padEnd(16, " ");

  // audio
  const audioState = hasToken ? "READY" : "----";
  slotAudio.textContent = ("AUDIO:" + " " + audioState).padEnd(16, " ");

  // video
  const videoState = irisState === "ACTIVE" ? "READY" : "----";
  slotVideo.textContent = ("VIDEO:" + " " + videoState).padEnd(16, " ");

  // profile
  const profile = currentFirmware ? currentFirmware.profile : "NONE";
  slotProfile.textContent = ("PROFILE:" + " " + profile).padEnd(18, " ");

  // fan spinner tied to stress
  if (fanOn) {
    if (!window._fanTick) window._fanTick = 0;
    let step = 6;
    if (lastStress > 0.25) step = 3;
    if (lastStress > 0.55) step = 1;
    if (window._fanTick % step === 0) {
      if (!window._fanFrameIndex) window._fanFrameIndex = 0;
      const frames = ["|", "/", "-", "\\"];
      window._fanFrameIndex = (window._fanFrameIndex + 1) % frames.length;
      const fChar = frames[window._fanFrameIndex];
      slotFan.textContent = ("FAN:" + " " + fChar).padEnd(12, " ");
    }
    window._fanTick++;
  }
}

function updateLine2() {
  if (!currentFirmware) {
    line2Text.textContent = "SECURE ALIGNMENT ROM MODULE: NONE";
    if (profileCodeText) profileCodeText.textContent = "NONE";
    if (romStatusText) romStatusText.textContent = "NONE";
  } else {
    line2Text.textContent = "SECURE ALIGNMENT ROM MODULE: " + currentFirmware.profile + " ACTIVE";
    if (profileCodeText) profileCodeText.textContent = currentFirmware.profile;
    if (romStatusText) romStatusText.textContent = currentFirmware.profile + " ACTIVE";
  }
}

function setActionActive(span, active) {
  if (!span) return;
  if (active) span.classList.add("actionActive");
  else span.classList.remove("actionActive");
}

function updateInitiateLabel() {
  if (!actSpace) return;
  actSpace.textContent = analysisRunning ? "[SPACE] TERMINATE" : "[SPACE] INITIATE";
}

// --- Media / TOKEN ---

async function requestToken() {
  if (hasToken) return;
  try {
    setStatus("REQUESTING AUDIO VIDEO PERMISSION");
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      if (irisVideo) irisVideo.srcObject = mediaStream;
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const src = audioContext.createMediaStreamSource(mediaStream);
      analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 1024;
      audioDataArray = new Uint8Array(analyserNode.fftSize);
      src.connect(analyserNode);
    }
    hasToken = true;
    setActionActive(actK, true);
    setStatus("TOKEN VERIFIED");
    logEvent("Tyrell CO. Secure Alignment ROM Module: TOKEN VERIFIED - MEDIA STREAM ACTIVE");
    initSpeechRecognition();
  } catch (err) {
    console.error(err);
    hasToken = false;
    setActionActive(actK, false);
    setStatus("PERMISSION ERROR");
    logEvent("ERROR: " + err.message);
  }
}

// --- Display / IRIS gating ---

function updateDisplayState() {
  // IRIS
  if (!displayOn) {
    if (irisPlaceholder) irisPlaceholder.style.display = "flex";
    if (irisBars) irisBars.style.display = "none";
    if (irisVideo) irisVideo.style.display = "none";
  } else {
    if (irisState === "ACTIVE") {
      if (irisPlaceholder) irisPlaceholder.style.display = "none";
      if (irisBars) irisBars.style.display = "none";
      if (irisVideo) irisVideo.style.display = "block";
    } else {
      if (irisPlaceholder) irisPlaceholder.style.display = "none";
      if (irisBars) irisBars.style.display = "flex";
      if (irisVideo) irisVideo.style.display = "none";
    }
  }

  // Voice / Nexus placeholders
  if (!displayOn) {
    if (voicePlaceholder) voicePlaceholder.style.display = "flex";
    if (nexusPlaceholder) nexusPlaceholder.style.display = "flex";
  } else {
    if (voicePlaceholder) voicePlaceholder.style.display = "none";
    if (nexusPlaceholder) nexusPlaceholder.style.display = "none";
  }
}

// --- Speech Recognition ---

function initSpeechRecognition() {
  if (!SR) {
    logEvent("SPEECH RECOGNITION NOT SUPPORTED");
    return;
  }
  if (recognition) return;

  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onresult = (e) => {
    const res = e.results[e.results.length - 1];
    if (!res.isFinal) return;
    const text = res[0].transcript.trim();
    if (!text) return;

    let cls = "unclassified";
    if (currentFirmware) {
      const lower = text.toLowerCase();
      for (const q of currentFirmware.questions) {
        const t = q.text.toLowerCase();
        const r = q.expectedReply.toLowerCase();
        if (t.indexOf(lower) !== -1 || lower.indexOf(t.slice(0, 20)) !== -1) {
          cls = q.class;
          break;
        }
        if (r.indexOf(lower) !== -1 || lower.indexOf(r.slice(0, 10)) !== -1) {
          cls = q.class;
          break;
        }
      }
    }
    logEvent(`SR: "${text}"  [${cls}]`);
  };

  recognition.onerror = (e) => {
    logEvent("SPEECH ERROR: " + e.error);
  };

  recognition.onend = () => {
    srActive = false;
    if (analysisRunning) {
      try {
        recognition.start();
        srActive = true;
      } catch (e) {
        logEvent("SPEECH RESTART FAILED: " + e.message);
      }
    }
  };
}

function updateSpeechState() {
  if (!recognition) return;
  if (analysisRunning && !srActive) {
    try {
      recognition.start();
      srActive = true;
      logEvent("SPEECH RECOGNITION STARTED");
    } catch (e) {
      logEvent("SPEECH START FAILED: " + e.message);
    }
  } else if (!analysisRunning && srActive) {
    recognition.stop();
    srActive = false;
    logEvent("SPEECH RECOGNITION STOPPED");
  }
}

// --- Key / click handling ---

let lastSpaceDown = false;

function handleKey(e) {
  const key = e.key.toLowerCase();

  if (key === "k") {
    if (e.type === "keydown") requestToken();
  } else if (key === "d") {
    if (!hasToken || e.type !== "keydown") return;
    if (irisState !== "ACTIVE") {
      setStatus("IRIS NOT DEPLOYED - CANNOT ENABLE DISPLAYS");
      logEvent("DISPLAY BLOCKED: IRIS NOT ACTIVE");
      setActionActive(actD, false);
      displayOn = false;
      updateDisplayState();
      return;
    }
    displayOn = !displayOn;
    setActionActive(actD, displayOn);
    setStatus(displayOn ? "DISPLAYS ACTIVE" : "DISPLAYS OFF");
    logEvent(displayOn ? "DISPLAYS ENABLED" : "DISPLAYS DISABLED");
    updateDisplayState();
  } else if (key === "f") {
    if (!hasToken || e.type !== "keydown") return;
    fanOn = !fanOn;
    setActionActive(actF, fanOn);
    setStatus(fanOn ? "FAN ACTIVE" : "FAN OFF");
    logEvent(fanOn ? "FAN ENABLED" : "FAN DISABLED");
  } else if (key === "i") {
    if (!hasToken || e.type !== "keydown") return;
    irisTargetActive = !irisTargetActive;
    const msg = irisTargetActive ? "IRIS ARM DEPLOY SEQUENCE" : "IRIS ARM RETRACT SEQUENCE";
    setStatus(msg);
    logEvent(msg + " (future: GPIO arm + camera) ");
    setActionActive(actI, irisTargetActive || irisState !== "OFF");
  } else if (key === " ") {
    if (!hasToken) return;
    if (e.type === "keydown") {
      if (lastSpaceDown) return;
      lastSpaceDown = true;
      if (!displayOn || irisState !== "ACTIVE") {
        setStatus("CANNOT INITIATE - DISPLAYS OFF OR IRIS NOT ACTIVE");
        logEvent("INITIATE FAILED - PRECONDITION");
        return;
      }
      analysisRunning = !analysisRunning;
      setActionActive(actSpace, analysisRunning);
      updateInitiateLabel();
      setStatus(analysisRunning ? "TEST SEQUENCE RUNNING" : "TEST SEQUENCE HALTED");
      logEvent(analysisRunning ? "INITIATE PRESSED" : "TERMINATE PRESSED");
      updateSpeechState();
    } else if (e.type === "keyup") {
      lastSpaceDown = false;
    }
  } else if (key === "l" && e.type === "keydown") {
    if (!hasToken) return;
    toggleWindow(logWindow);
    setActionActive(actL, logWindow.style.display === "block");
  } else if (key === "w" && e.type === "keydown") {
    if (!hasToken) return;
    toggleWindow(w3sWindow);
    setActionActive(actW, w3sWindow.style.display === "block");
  } else if (key === "v" && e.type === "keydown") {
    if (!hasToken) return;
    toggleWindow(vuWindow);
    setActionActive(actV, vuWindow.style.display === "block");
  } else if (key === "s" && e.type === "keydown") {
    if (!hasToken) return;
    toggleWindow(sysWindow);
    setActionActive(actS, sysWindow.style.display === "block");
  } else if (key === "escape" && e.type === "keydown") {
    [logWindow, w3sWindow, sysWindow, vuWindow].forEach(win => {
      if (win && win.style.display === "block") win.style.display = "none";
    });
    [actL, actW, actS, actV].forEach(a => a && a.classList.remove("actionActive"));
  }
}

document.addEventListener("keydown", handleKey);
document.addEventListener("keyup", handleKey);

// Click mapping to same handlers
if (actK) actK.addEventListener("click", () => handleKey({ key: "k", type: "keydown" }));
if (actD) actD.addEventListener("click", () => handleKey({ key: "d", type: "keydown" }));
if (actF) actF.addEventListener("click", () => handleKey({ key: "f", type: "keydown" }));
if (actI) actI.addEventListener("click", () => handleKey({ key: "i", type: "keydown" }));
if (actSpace) actSpace.addEventListener("click", () => handleKey({ key: " ", type: "keydown" }));
if (actL) actL.addEventListener("click", () => handleKey({ key: "l", type: "keydown" }));
if (actW) actW.addEventListener("click", () => handleKey({ key: "w", type: "keydown" }));
if (actV) actV.addEventListener("click", () => handleKey({ key: "v", type: "keydown" }));
if (actS) actS.addEventListener("click", () => handleKey({ key: "s", type: "keydown" }));

// --- Floating windows drag / resize ---

let dragWin = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

let resizeWin = null;
let resizeStartX = 0;
let resizeStartY = 0;
let resizeStartW = 0;
let resizeStartH = 0;

document.querySelectorAll(".winTitle").forEach(tb => {
  tb.addEventListener("mousedown", e => {
    const id = tb.getAttribute("data-drag");
    const win = document.getElementById(id);
    if (!win) return;
    dragWin = win;
    const rect = win.getBoundingClientRect();
    const appRect = document.querySelector(".app").getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    e.preventDefault();
  });
});

document.querySelectorAll(".winResize").forEach(h => {
  h.addEventListener("mousedown", e => {
    const id = h.getAttribute("data-resize");
    const win = document.getElementById(id);
    if (!win) return;
    resizeWin = win;
    const rect = win.getBoundingClientRect();
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    resizeStartW = rect.width;
    resizeStartH = rect.height;
    e.preventDefault();
  });
});

document.querySelectorAll(".winClose").forEach(btn => {
  btn.addEventListener("click", () => {
    const id = btn.getAttribute("data-close");
    const win = document.getElementById(id);
    if (win) win.style.display = "none";
  });
});

// Drag analyzer panels (iris, voice, nexus)
let dragPanel = null;
let dragPanelOffsetX = 0;
let dragPanelOffsetY = 0;

["voicePanel", "nexusPanel", "irisScreen"].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("mousedown", e => {
    dragPanel = el;
    const rect = el.getBoundingClientRect();
    const appRect = document.querySelector(".app").getBoundingClientRect();
    dragPanelOffsetX = e.clientX - rect.left;
    dragPanelOffsetY = e.clientY - rect.top;
    e.preventDefault();
  });
});

document.addEventListener("mousemove", e => {
  const appRect = document.querySelector(".app").getBoundingClientRect();
  if (dragWin) {
    const x = e.clientX - dragOffsetX - appRect.left;
    const y = e.clientY - dragOffsetY - appRect.top;
    dragWin.style.left = x + "px";
    dragWin.style.top = y + "px";
  }
  if (resizeWin) {
    const dx = e.clientX - resizeStartX;
    const dy = e.clientY - resizeStartY;
    const w = Math.max(260, resizeStartW + dx);
    const h = Math.max(160, resizeStartH + dy);
    resizeWin.style.width = w + "px";
    resizeWin.style.height = h + "px";
  }
  if (dragPanel) {
    const x = e.clientX - dragPanelOffsetX - appRect.left;
    const y = e.clientY - dragPanelOffsetY - appRect.top;
    dragPanel.style.left = x + "px";
    dragPanel.style.top = y + "px";
  }
});

document.addEventListener("mouseup", () => {
  dragWin = null;
  resizeWin = null;
  dragPanel = null;
});

// --- Theme handling ---

if (applyThemeBtn) {
  applyThemeBtn.addEventListener("click", () => {
    const radios = document.querySelectorAll('input[name="themeRadio"]');
    let val = "theme-esper";
    radios.forEach(r => { if (r.checked) val = r.value; });
    if (themeRoot) themeRoot.className = val;
    logEvent("THEME APPLIED: " + val);
  });
}

document.querySelectorAll('input[name="soundRadio"]').forEach(radio => {
  radio.addEventListener("change", () => {
    soundEnabled = (radio.value === "on");
    logEvent("SOUND " + (soundEnabled ? "ENABLED" : "DISABLED"));
  });
});

// --- Firmware loading ---

async function loadDefaultFirmware() {
  try {
    const resp = await fetch("W3SSB.json");
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    currentFirmware = await resp.json();
    if (sysCurrentROM) sysCurrentROM.textContent = currentFirmware.profile;
    if (firmwareStatus) firmwareStatus.textContent = "Default firmware loaded: " + currentFirmware.profile;
    logEvent("DEFAULT FIRMWARE LOADED: " + currentFirmware.profile);
    updateW3SContent();
    updateLine2();
  } catch (err) {
    if (firmwareStatus) firmwareStatus.textContent = "Default firmware load failed.";
    logEvent("FIRMWARE LOAD ERROR: " + err.message);
  }
}

function updateW3SContent() {
  const box = document.getElementById("w3sContent");
  if (!box) return;
  if (!currentFirmware) {
    box.textContent = "NO ROM MODULE LOADED.";
    return;
  }
  let html = "";
  html += `<div class="w3s-title">PROFILE: ${currentFirmware.profile}</div>`;
  html += `<div class="w3s-sub">${currentFirmware.manufacturer}</div>`;
  html += `<hr>`;
  currentFirmware.questions.forEach(q => {
    html += `<div class="w3s-block">`;
    html += `<div class="w3s-question">${q.text}</div>`;
    html += `<div class="w3s-reply">Expected Response: ${q.expectedReply}</div>`;
    html += `<div class="w3s-weight">Weight: ${(q.weight * 100).toFixed(1)}%</div>`;
    html += `</div>`;
  });
  box.innerHTML = html;
}

const firmwareFilePicker = document.getElementById("firmwareFilePicker");
if (firmwareFilePicker) {
  firmwareFilePicker.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    if (firmwareStatus) firmwareStatus.textContent = "Loading firmware...";
    const reader = new FileReader();
    reader.onload = () => {
      try {
        currentFirmware = JSON.parse(reader.result);
        if (sysCurrentROM) sysCurrentROM.textContent = currentFirmware.profile;
        if (firmwareStatus) firmwareStatus.textContent = "Firmware updated: " + currentFirmware.profile;
        logEvent("ROM MODULE UPDATED -> " + currentFirmware.profile);
        updateW3SContent();
        updateLine2();
      } catch (err) {
        if (firmwareStatus) firmwareStatus.textContent = "Invalid firmware file.";
        logEvent("FIRMWARE PARSE ERROR: " + err.message);
      }
    };
    reader.readAsText(file);
  });
}

// --- Voice Analyzer drawing ---

function drawVoice() {
  const canvas = voiceCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#fff";
  ctx.font = "20px 'Arial Narrow', sans-serif";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  const headerTop = 8;
  ctx.fillText("VOICE ANALYZER", 10, headerTop);
  ctx.textAlign = "right";
  ctx.fillText("TYRELL CO.", w - 10, headerTop);

  if (!hasToken || !displayOn || irisState !== "ACTIVE" || !analyserNode || !audioDataArray || !analysisRunning) return;

  const gridTop = headerTop + 40;
  const gridBottom = h - 90;

  analyserNode.getByteTimeDomainData(audioDataArray);

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < audioDataArray.length; i++) {
    const v = (audioDataArray[i] - 128) / 128;
    const x = (i / (audioDataArray.length - 1)) * w;
    const y = gridTop + (gridBottom - gridTop) * (0.5 - v * 0.4);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Markers + and |
  ctx.font = "16px 'Arial Narrow', sans-serif";
  ctx.textBaseline = "bottom";
  ctx.textAlign = "center";
  const cx = w / 2;
  const markerTop = gridTop - 8;
  ctx.fillText("+", cx - 10, markerTop);
  ctx.fillText("|", cx + 10, markerTop);

  ctx.strokeStyle = "#777";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 10, gridTop);
  ctx.lineTo(cx - 10, gridBottom);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 10, gridTop);
  ctx.lineTo(cx + 10, gridBottom);
  ctx.stroke();

  // Stress + deviation
  let sum = 0;
  for (let i = 0; i < audioDataArray.length; i++) {
    const v = (audioDataArray[i] - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / audioDataArray.length);
  lastRms = rms;
  const stress = Math.min(1, rms * 4);
  lastStress = stress;

  const bandTop = h - 80;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillStyle = "#fff";
  ctx.fillText("STRESS LEVEL", 10, bandTop);
  ctx.textAlign = "right";
  ctx.fillText(Math.round(stress * 100) + "%", w - 10, bandTop);

  const barX1 = 10;
  const barX2 = w - 10;
  const barY = bandTop + 24;
  const barH = 8;

  ctx.strokeStyle = "#fff";
  ctx.strokeRect(barX1, barY, barX2 - barX1, barH);

  const arrowX = barX1 + (barX2 - barX1) * stress;
  const arrowY = barY + barH + 6;

  ctx.beginPath();
  ctx.moveTo(arrowX, arrowY);
  ctx.lineTo(arrowX - 6, arrowY + 10);
  ctx.lineTo(arrowX + 6, arrowY + 10);
  ctx.closePath();
  ctx.fillStyle = "#fff";
  ctx.fill();

  const devLabelY = bandTop + 46;
  ctx.textAlign = "left";
  ctx.fillText("DEVIATION:", 10, devLabelY);

  const devY = devLabelY + 18;
  const devX1 = 10;
  const devX2 = w - 10;

  ctx.strokeStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(devX1, devY);
  ctx.lineTo(devX2, devY);
  ctx.stroke();

  const t = performance.now() / 1000;
  const jitter = 0.05 * Math.sin(t * 0.7);
  const devBase = 0.75;
  const devPos = devX1 + (devX2 - devX1) * Math.min(1, Math.max(0, devBase + jitter));

  ctx.beginPath();
  ctx.moveTo(devPos, devY - 8);
  ctx.lineTo(devPos - 6, devY);
  ctx.lineTo(devPos + 6, devY);
  ctx.closePath();
  ctx.fillStyle = "#fff";
  ctx.fill();
}

// --- Nexus Gen Probability ---

let nexusPhase = 0;
const nexusPoints = [];

function drawNexus() {
  const canvas = nexusCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);

  const outerPad = 10;
  const left = outerPad;
  const right = w - outerPad;

  const headerTop = outerPad;
  const headerLineGap = 22;
  const gridTop = headerTop + 40;
  const gridBottom = h - outerPad - 40;

  ctx.fillStyle = "#000";
  ctx.font = "18px 'Arial Narrow', sans-serif";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText("NEXUS GEN PROBABILITY", left + 2, headerTop);
  ctx.fillText("BASELINE DEVIATION ANALYSIS", left + 2, headerTop + headerLineGap);

  ctx.textAlign = "right";
  ctx.fillText("W3S SB", right - 2, headerTop);
  ctx.fillText("µg/sec", right - 2, headerTop + headerLineGap);

  // 2 rows x 3 cols grid
  ctx.strokeStyle = "#ccc";
  ctx.lineWidth = 0.5;
  const cols = 3;
  const rows = 2;
  for (let i = 1; i < cols; i++) {
    const x = left + (right - left) * (i / cols);
    ctx.beginPath();
    ctx.moveTo(x, gridTop);
    ctx.lineTo(x, gridBottom);
    ctx.stroke();
  }
  for (let j = 1; j < rows; j++) {
    const y = gridTop + (gridBottom - gridTop) * (j / rows);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#000";
  ctx.textBaseline = "bottom";
  ctx.textAlign = "left";
  const labelY = gridBottom + 18;
  ctx.fillText("0", left + 5, labelY);

  ctx.textAlign = "center";
  ctx.fillText("10", left + (right - left) * (1 / 3), labelY);
  ctx.fillText("100", left + (right - left) * (2 / 3), labelY);

  ctx.textAlign = "right";
  ctx.fillText("1000", right - 5, labelY);

  const copyrightY = labelY + 18;
  ctx.textAlign = "right";
  ctx.fillText("© TYRELL CORP", right - 2, copyrightY);

  if (!hasToken || !displayOn || irisState !== "ACTIVE" || !analysisRunning) return;

  // Red mean line
  const meanY = gridTop + (gridBottom - gridTop) * (0.5 + 0.05 * Math.sin(nexusPhase));
  const stripLeft = right - (right - left) * 0.25;
  ctx.strokeStyle = "rgba(255,0,0,0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(stripLeft, meanY);
  ctx.lineTo(right, meanY);
  ctx.stroke();

  // Spawn points
  if (Math.random() < 0.08) {
    const conf = 0.8 + 0.2 * Math.random();
    const px = stripLeft + (right - stripLeft) * (0.2 + 0.8 * Math.random());
    const py = meanY + (Math.random() - 0.5) * (gridBottom - gridTop) * 0.06;
    nexusPoints.push({
      x: px,
      y: py,
      confidence: conf,
      createdAt: performance.now() / 1000
    });
  }

  const now = performance.now() / 1000;
  for (let i = nexusPoints.length - 1; i >= 0; i--) {
    const p = nexusPoints[i];
    const age = now - p.createdAt;
    const isHigh = p.confidence >= 0.8;
    const life = isHigh ? 20 : 10;
    if (age > life) {
      nexusPoints.splice(i, 1);
      continue;
    }

    let alpha;
    if (isHigh) alpha = Math.max(0, 1 - age / life);
    else {
      const n = age / life;
      alpha = Math.sin(n * Math.PI);
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    if (isHigh) {
      const pulse = 1 + 0.15 * Math.sin(now * 3);
      ctx.arc(p.x, p.y, 10 * pulse, 0, Math.PI * 2);
    } else {
      ctx.ellipse(p.x, p.y, 14, 8, 0, 0, Math.PI * 2);
    }
    ctx.fill();

    if (age < 3) {
      ctx.globalAlpha = 1 - age / 3;
      ctx.fillStyle = "rgba(255,0,0,1)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  nexusPhase += 0.03;
}

// --- IRIS state machine ---

function updateIris(dt) {
  irisStepTimer += dt;
  irisBlinkTimer += dt;
  if (irisBlinkTimer > 2) {
    irisBlink = !irisBlink;
    irisBlinkTimer = 0;
  }

  if (irisStepTimer < 0.7) return;
  irisStepTimer = 0;

  const seq = ["OFF", "STAGE1", "STAGE2", "STAGE3", "ACTIVE"];
  if (irisTargetActive) {
    const idx = seq.indexOf(irisState);
    if (idx < seq.length - 1) {
      irisState = seq[idx + 1];
      logEvent("IRIS STATE -> " + irisState);
      if (irisState === "ACTIVE") setStatus("IRIS CAMERA ACTIVE");
    }
  } else {
    const idx = seq.indexOf(irisState);
    if (idx > 0) {
      irisState = seq[idx - 1];
      logEvent("IRIS STATE -> " + irisState);
      if (irisState === "OFF") setStatus("IRIS CAMERA PARKED");
    }
  }
}


// --- VU meters ---

// Wide, low audio meter: 5px wide, 2px tall segments (approx)
function drawVUHoriz(ctx, w, h, value) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  const segments = 10;
  const gap = 4;

  const segW = (w - (segments + 1) * gap) / segments;
  const segH = Math.min(2, h - 8);
  const baseY = h / 2 + segH / 2;

  for (let i = 0; i < segments; i++) {
    const x = gap + i * (segW + gap);
    const active = (value * segments) > i;

    let color = "#00ff66";
    if (i === 6) color = "#ffff33";
    if (i >= 7) color = "#ff3333";

    ctx.strokeStyle = "#555";
    ctx.strokeRect(x, baseY - segH, segW, segH);

    if (active) {
      ctx.fillStyle = color;
      ctx.fillRect(x + 1, baseY - segH + 1, segW - 2, segH - 2);
    }
  }
}

function drawVUStress(ctx, w, h, value) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  const segments = 10;
  const gap = 4;

  const segW = Math.min(2, (w - (segments + 1) * gap) / (segments * 2));
  const segH = Math.min(5, h - 8);

  const baseY = h / 2 + segH / 2;

  for (let i = 0; i < segments; i++) {
    const x = gap + i * (segW + gap);
    const active = (value * segments) > i;

    const color = "#ff3333";

    ctx.strokeStyle = "#555";
    ctx.strokeRect(x, baseY - segH, segW, segH);

    if (active) {
      ctx.fillStyle = color;
      ctx.fillRect(x + 1, baseY - segH + 1, segW - 2, segH - 2);
    }
  }
}

function drawVU() {
  if (!vuWindow || vuWindow.style.display !== "block") return;

  const modeRadios = document.querySelectorAll('input[name="vuMode"]');
  let mode = "both";
  modeRadios.forEach(r => { if (r.checked) mode = r.value; });

  const vol = lastRms;
  const stress = lastStress;

  if (vuHorizontal) {
    const ctxH = vuHorizontal.getContext("2d");
    if (mode === "both" || mode === "horizontal") {
      drawVUHoriz(ctxH, vuHorizontal.width, vuHorizontal.height, vol);
      vuHorizontal.style.display = "block";
    } else {
      ctxH.clearRect(0, 0, vuHorizontal.width, vuHorizontal.height);
      vuHorizontal.style.display = "none";
    }
  }

  if (vuVertical) {
    const ctxV = vuVertical.getContext("2d");
    if (mode === "both" || mode === "vertical") {
      drawVUStress(ctxV, vuVertical.width, vuVertical.height, stress);
      vuVertical.style.display = "block";
    } else {
      ctxV.clearRect(0, 0, vuVertical.width, vuVertical.height);
      vuVertical.style.display = "none";
    }
  }
}

// --- Window toggle helper ---
// --- Window toggle helper ---

function toggleWindow(win) {
  if (!win) return;
  win.style.display = (win.style.display === "block") ? "none" : "block";
}

// --- Animation loop ---

let lastTime = performance.now();

function animate() {
  const now = performance.now();
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  updateIris(dt);
  updateFooterLine1();

  if (displayOn) {
    drawVoice();
    drawNexus();
  }
  drawVU();

  requestAnimationFrame(animate);
}

// --- Init ---

updateFooterLine1();
updateLine2();
setStatus("SYSTEM IDLE - PRESS K TO LOAD TOKEN");
updateDisplayState();
updateInitiateLabel();
loadDefaultFirmware();
animate();
