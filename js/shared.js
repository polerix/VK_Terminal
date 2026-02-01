// shared.js — Core state, media capture, BroadcastChannel sync
// All pages import this for shared state

const VK = {
  // State
  hasToken: false,
  displayOn: false,
  analysisRunning: false,
  fanOn: false,
  soundEnabled: false,
  
  irisState: "OFF", // OFF, STAGE1, STAGE2, STAGE3, ACTIVE
  irisTargetActive: false,
  irisBlink: false,
  irisBlinkTimer: 0,
  irisStepTimer: 0,
  
  // Audio analysis
  mediaStream: null,
  audioContext: null,
  analyserNode: null,
  audioDataArray: null,
  lastRms: 0,
  lastStress: 0,
  
  // Firmware
  currentFirmware: null,
  
  // Logging
  logBuffer: [],
  LOG_LIMIT: 500,
  
  // BroadcastChannel for cross-window sync
  channel: null,
  
  // Callbacks for state change listeners
  listeners: [],
};

// --- BroadcastChannel Setup ---

VK.initChannel = function() {
  if (typeof BroadcastChannel === "undefined") {
    console.warn("BroadcastChannel not supported");
    return;
  }
  VK.channel = new BroadcastChannel("vk_terminal_sync");
  VK.channel.onmessage = (e) => {
    const msg = e.data;
    if (msg.type === "state") {
      // Update local state from broadcast
      Object.assign(VK, msg.state);
      VK.notifyListeners();
    } else if (msg.type === "log") {
      VK.logBuffer.push(msg.line);
      if (VK.logBuffer.length > VK.LOG_LIMIT) VK.logBuffer.shift();
    }
  };
};

VK.broadcastState = function() {
  if (!VK.channel) return;
  VK.channel.postMessage({
    type: "state",
    state: {
      hasToken: VK.hasToken,
      displayOn: VK.displayOn,
      analysisRunning: VK.analysisRunning,
      fanOn: VK.fanOn,
      soundEnabled: VK.soundEnabled,
      irisState: VK.irisState,
      irisTargetActive: VK.irisTargetActive,
      irisBlink: VK.irisBlink,
      lastRms: VK.lastRms,
      lastStress: VK.lastStress,
      currentFirmware: VK.currentFirmware,
    }
  });
};

VK.broadcastLog = function(line) {
  if (!VK.channel) return;
  VK.channel.postMessage({ type: "log", line });
};

// --- Listeners ---

VK.addListener = function(fn) {
  VK.listeners.push(fn);
};

VK.notifyListeners = function() {
  VK.listeners.forEach(fn => fn());
};

// --- Logging ---

VK.logEvent = function(msg) {
  const ts = new Date().toISOString().substr(11, 8);
  const line = `[${ts}] ${msg}`;
  VK.logBuffer.push(line);
  if (VK.logBuffer.length > VK.LOG_LIMIT) VK.logBuffer.shift();
  VK.broadcastLog(line);
  console.log(line);
};

// --- Media / Token ---

VK.requestToken = async function() {
  if (VK.hasToken) return;
  try {
    VK.logEvent("REQUESTING AUDIO VIDEO PERMISSION");
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      VK.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      VK.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const src = VK.audioContext.createMediaStreamSource(VK.mediaStream);
      VK.analyserNode = VK.audioContext.createAnalyser();
      VK.analyserNode.fftSize = 1024;
      VK.audioDataArray = new Uint8Array(VK.analyserNode.fftSize);
      src.connect(VK.analyserNode);
    }
    VK.hasToken = true;
    VK.logEvent("TOKEN VERIFIED - MEDIA STREAM ACTIVE");
    VK.broadcastState();
    return true;
  } catch (err) {
    console.error(err);
    VK.hasToken = false;
    VK.logEvent("PERMISSION ERROR: " + err.message);
    return false;
  }
};

// --- IRIS state machine ---

VK.updateIris = function(dt) {
  VK.irisStepTimer += dt;
  VK.irisBlinkTimer += dt;
  if (VK.irisBlinkTimer > 2) {
    VK.irisBlink = !VK.irisBlink;
    VK.irisBlinkTimer = 0;
  }

  if (VK.irisStepTimer < 0.7) return;
  VK.irisStepTimer = 0;

  const seq = ["OFF", "STAGE1", "STAGE2", "STAGE3", "ACTIVE"];
  if (VK.irisTargetActive) {
    const idx = seq.indexOf(VK.irisState);
    if (idx < seq.length - 1) {
      VK.irisState = seq[idx + 1];
      VK.logEvent("IRIS STATE -> " + VK.irisState);
    }
  } else {
    const idx = seq.indexOf(VK.irisState);
    if (idx > 0) {
      VK.irisState = seq[idx - 1];
      VK.logEvent("IRIS STATE -> " + VK.irisState);
    }
  }
  VK.broadcastState();
};

// --- Audio analysis ---

VK.updateAudio = function() {
  if (!VK.analyserNode || !VK.audioDataArray) return;
  VK.analyserNode.getByteTimeDomainData(VK.audioDataArray);
  
  let sum = 0;
  for (let i = 0; i < VK.audioDataArray.length; i++) {
    const v = (VK.audioDataArray[i] - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / VK.audioDataArray.length);
  VK.lastRms = rms;
  VK.lastStress = Math.min(1, rms * 4);
};

// --- Firmware ---

VK.loadDefaultFirmware = async function() {
  try {
    const resp = await fetch("W3SSB.json");
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    VK.currentFirmware = await resp.json();
    VK.logEvent("DEFAULT FIRMWARE LOADED: " + VK.currentFirmware.profile);
    VK.broadcastState();
    return true;
  } catch (err) {
    VK.logEvent("FIRMWARE LOAD ERROR: " + err.message);
    return false;
  }
};

VK.loadFirmwareFromFile = function(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        VK.currentFirmware = JSON.parse(reader.result);
        VK.logEvent("ROM MODULE UPDATED -> " + VK.currentFirmware.profile);
        VK.broadcastState();
        resolve(VK.currentFirmware);
      } catch (err) {
        VK.logEvent("FIRMWARE PARSE ERROR: " + err.message);
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

// --- Theme ---

VK.currentTheme = "theme-esper";

VK.setTheme = function(theme) {
  VK.currentTheme = theme;
  localStorage.setItem("vk_theme", theme);
  VK.broadcastState();
};

VK.loadTheme = function() {
  const saved = localStorage.getItem("vk_theme");
  if (saved) VK.currentTheme = saved;
  return VK.currentTheme;
};

// --- Technician access key combo ---

VK.technicianKeyCombo = { ctrl: false, shift: false, t: false };

VK.checkTechnicianAccess = function(e) {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "t") {
    window.location.href = "technician.html";
    return true;
  }
  return false;
};

// --- Init ---

VK.init = function() {
  VK.initChannel();
  VK.loadTheme();
};

// Auto-init
if (typeof window !== "undefined") {
  VK.init();
}
