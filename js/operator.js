// operator.js — Main operator screen logic, key handling, footer

const Operator = {
  // DOM refs (set in init)
  elements: {},
  
  init: function() {
    // Footer slots
    this.elements.slotFan = document.getElementById("slotFan");
    this.elements.slotIris = document.getElementById("slotIris");
    this.elements.slotAudio = document.getElementById("slotAudio");
    this.elements.slotVideo = document.getElementById("slotVideo");
    this.elements.slotProfile = document.getElementById("slotProfile");
    this.elements.slotStatus = document.getElementById("slotStatus");
    this.elements.line2Text = document.getElementById("line2Text");
    
    // Action keys
    this.elements.actK = document.getElementById("actK");
    this.elements.actD = document.getElementById("actD");
    this.elements.actF = document.getElementById("actF");
    this.elements.actI = document.getElementById("actI");
    this.elements.actSpace = document.getElementById("actSpace");
    
    // Windows (optional on operator screen)
    this.elements.logWindow = document.getElementById("logWindow");
    this.elements.logContent = document.getElementById("logContent");
    
    // Video
    this.elements.irisVideo = document.getElementById("irisVideo");
    this.elements.irisBars = document.getElementById("irisBars");
    this.elements.irisPlaceholder = document.getElementById("irisPlaceholder");
    
    // Theme root
    this.elements.themeRoot = document.getElementById("themeRoot");
    
    // Set up key handlers
    document.addEventListener("keydown", (e) => this.handleKey(e, "keydown"));
    document.addEventListener("keyup", (e) => this.handleKey(e, "keyup"));
    
    // Click handlers for action keys
    this.bindActionClick("actK", "k");
    this.bindActionClick("actD", "d");
    this.bindActionClick("actF", "f");
    this.bindActionClick("actI", "i");
    this.bindActionClick("actSpace", " ");
    
    // Listen for state changes
    VK.addListener(() => this.onStateChange());
    
    // Apply theme
    this.applyTheme();
    
    // Initial UI update
    this.updateUI();
  },
  
  bindActionClick: function(id, key) {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("click", () => this.handleKey({ key, type: "keydown" }, "keydown"));
    }
  },
  
  applyTheme: function() {
    if (this.elements.themeRoot) {
      this.elements.themeRoot.className = VK.currentTheme;
    }
  },
  
  onStateChange: function() {
    this.updateUI();
    this.applyTheme();
  },
  
  lastSpaceDown: false,
  
  handleKey: function(e, type) {
    // Check for technician access
    if (type === "keydown" && VK.checkTechnicianAccess(e)) return;
    
    const key = e.key ? e.key.toLowerCase() : "";
    
    if (key === "k" && type === "keydown") {
      VK.requestToken().then(() => this.updateUI());
    }
    else if (key === "d" && type === "keydown") {
      if (!VK.hasToken) return;
      if (VK.irisState !== "ACTIVE") {
        this.setStatus("IRIS NOT DEPLOYED - CANNOT ENABLE DISPLAYS");
        return;
      }
      VK.displayOn = !VK.displayOn;
      VK.broadcastState();
      this.setStatus(VK.displayOn ? "DISPLAYS ACTIVE" : "DISPLAYS OFF");
      this.updateUI();
    }
    else if (key === "f" && type === "keydown") {
      if (!VK.hasToken) return;
      VK.fanOn = !VK.fanOn;
      VK.broadcastState();
      this.setStatus(VK.fanOn ? "FAN ACTIVE" : "FAN OFF");
      this.updateUI();
    }
    else if (key === "i" && type === "keydown") {
      if (!VK.hasToken) return;
      VK.irisTargetActive = !VK.irisTargetActive;
      const msg = VK.irisTargetActive ? "IRIS ARM DEPLOY SEQUENCE" : "IRIS ARM RETRACT SEQUENCE";
      this.setStatus(msg);
      VK.broadcastState();
    }
    else if (key === " ") {
      if (!VK.hasToken) return;
      if (type === "keydown") {
        if (this.lastSpaceDown) return;
        this.lastSpaceDown = true;
        if (!VK.displayOn || VK.irisState !== "ACTIVE") {
          this.setStatus("CANNOT INITIATE - DISPLAYS OFF OR IRIS NOT ACTIVE");
          return;
        }
        VK.analysisRunning = !VK.analysisRunning;
        VK.broadcastState();
        this.setStatus(VK.analysisRunning ? "TEST SEQUENCE RUNNING" : "TEST SEQUENCE HALTED");
        this.updateUI();
      } else if (type === "keyup") {
        this.lastSpaceDown = false;
      }
    }
    else if (key === "escape" && type === "keydown") {
      // Close windows
      if (this.elements.logWindow) this.elements.logWindow.style.display = "none";
    }
  },
  
  setStatus: function(text) {
    const maxLen = 40;
    let t = text || "";
    if (t.length > maxLen) t = t.slice(0, maxLen - 1) + "…";
    if (this.elements.slotStatus) {
      this.elements.slotStatus.textContent = ("STATUS: " + t).padEnd(40, " ");
    }
    VK.logEvent("STATUS: " + text);
  },
  
  irisDisplayText: function() {
    switch (VK.irisState) {
      case "OFF": return "   ";
      case "STAGE1": return "***";
      case "STAGE2": return "** ";
      case "STAGE3": return " * ";
      case "ACTIVE": return VK.irisBlink ? "  *" : "   ";
      default: return "   ";
    }
  },
  
  updateUI: function() {
    const e = this.elements;
    
    // Footer line 1
    if (e.slotFan) {
      let fanText = "FAN: ";
      if (VK.fanOn) {
        if (!window._fanFrameIndex) window._fanFrameIndex = 0;
        const frames = ["|", "/", "-", "\\"];
        window._fanFrameIndex = (window._fanFrameIndex + 1) % frames.length;
        fanText += frames[window._fanFrameIndex];
      }
      e.slotFan.textContent = fanText.padEnd(12, " ");
    }
    
    if (e.slotIris) {
      e.slotIris.textContent = ("IRIS: " + this.irisDisplayText()).padEnd(16, " ");
    }
    
    if (e.slotAudio) {
      const audioState = VK.hasToken ? "READY" : "----";
      e.slotAudio.textContent = ("AUDIO: " + audioState).padEnd(16, " ");
    }
    
    if (e.slotVideo) {
      const videoState = VK.irisState === "ACTIVE" ? "READY" : "----";
      e.slotVideo.textContent = ("VIDEO: " + videoState).padEnd(16, " ");
    }
    
    if (e.slotProfile) {
      const profile = VK.currentFirmware ? VK.currentFirmware.profile : "NONE";
      e.slotProfile.textContent = ("PROFILE: " + profile).padEnd(18, " ");
    }
    
    // Footer line 2
    if (e.line2Text) {
      if (!VK.currentFirmware) {
        e.line2Text.textContent = "SECURE ALIGNMENT ROM MODULE: NONE";
      } else {
        e.line2Text.textContent = "SECURE ALIGNMENT ROM MODULE: " + VK.currentFirmware.profile + " ACTIVE";
      }
    }
    
    // Action key highlights
    this.setActionActive("actK", VK.hasToken);
    this.setActionActive("actD", VK.displayOn);
    this.setActionActive("actF", VK.fanOn);
    this.setActionActive("actI", VK.irisTargetActive || VK.irisState !== "OFF");
    this.setActionActive("actSpace", VK.analysisRunning);
    
    // Initiate label
    if (e.actSpace) {
      e.actSpace.textContent = VK.analysisRunning ? "[SPACE] TERMINATE" : "[SPACE] INITIATE";
    }
    
    // Display state
    this.updateDisplayState();
    
    // Attach video stream if available
    if (e.irisVideo && VK.mediaStream && !e.irisVideo.srcObject) {
      e.irisVideo.srcObject = VK.mediaStream;
    }
    
    // Log content
    if (e.logContent) {
      e.logContent.textContent = VK.logBuffer.join("\n");
      e.logContent.scrollTop = e.logContent.scrollHeight;
    }
  },
  
  setActionActive: function(id, active) {
    const el = document.getElementById(id);
    if (!el) return;
    if (active) el.classList.add("actionActive");
    else el.classList.remove("actionActive");
  },
  
  updateDisplayState: function() {
    const e = this.elements;
    
    if (!VK.displayOn) {
      if (e.irisPlaceholder) e.irisPlaceholder.style.display = "flex";
      if (e.irisBars) e.irisBars.style.display = "none";
      if (e.irisVideo) e.irisVideo.style.display = "none";
    } else {
      if (VK.irisState === "ACTIVE") {
        if (e.irisPlaceholder) e.irisPlaceholder.style.display = "none";
        if (e.irisBars) e.irisBars.style.display = "none";
        if (e.irisVideo) e.irisVideo.style.display = "block";
      } else {
        if (e.irisPlaceholder) e.irisPlaceholder.style.display = "none";
        if (e.irisBars) e.irisBars.style.display = "flex";
        if (e.irisVideo) e.irisVideo.style.display = "none";
      }
    }
  }
};
