// technician.js — Tyrell technician tools (theme, firmware, diagnostics)

const Technician = {
  elements: {},
  
  init: function() {
    this.elements.themeRoot = document.getElementById("themeRoot");
    this.elements.applyThemeBtn = document.getElementById("applyThemeBtn");
    this.elements.firmwareFilePicker = document.getElementById("firmwareFilePicker");
    this.elements.firmwareStatus = document.getElementById("firmwareStatus");
    this.elements.sysCurrentROM = document.getElementById("sysCurrentROM");
    this.elements.profileCodeText = document.getElementById("profileCodeText");
    this.elements.romStatusText = document.getElementById("romStatusText");
    this.elements.logContent = document.getElementById("logContent");
    
    // Theme handling
    if (this.elements.applyThemeBtn) {
      this.elements.applyThemeBtn.addEventListener("click", () => this.applyTheme());
    }
    
    // Firmware upload
    if (this.elements.firmwareFilePicker) {
      this.elements.firmwareFilePicker.addEventListener("change", (e) => this.handleFirmwareUpload(e));
    }
    
    // Sound toggle
    document.querySelectorAll('input[name="soundRadio"]').forEach(radio => {
      radio.addEventListener("change", () => {
        VK.soundEnabled = (radio.value === "on");
        VK.logEvent("SOUND " + (VK.soundEnabled ? "ENABLED" : "DISABLED"));
      });
    });
    
    // Back to operator link
    const backLink = document.getElementById("backToOperator");
    if (backLink) {
      backLink.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = "operator.html";
      });
    }
    
    // Listen for state changes
    VK.addListener(() => this.updateUI());
    
    // Load current theme into radio
    this.loadThemeSelection();
    
    // Initial UI
    this.updateUI();
  },
  
  loadThemeSelection: function() {
    const radios = document.querySelectorAll('input[name="themeRadio"]');
    radios.forEach(r => {
      if (r.value === VK.currentTheme) r.checked = true;
    });
  },
  
  applyTheme: function() {
    const radios = document.querySelectorAll('input[name="themeRadio"]');
    let val = "theme-esper";
    radios.forEach(r => { if (r.checked) val = r.value; });
    VK.setTheme(val);
    if (this.elements.themeRoot) {
      this.elements.themeRoot.className = val;
    }
    VK.logEvent("THEME APPLIED: " + val);
  },
  
  handleFirmwareUpload: function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (this.elements.firmwareStatus) {
      this.elements.firmwareStatus.textContent = "Loading firmware...";
    }
    
    VK.loadFirmwareFromFile(file)
      .then(fw => {
        if (this.elements.firmwareStatus) {
          this.elements.firmwareStatus.textContent = "Firmware updated: " + fw.profile;
        }
        this.updateUI();
      })
      .catch(err => {
        if (this.elements.firmwareStatus) {
          this.elements.firmwareStatus.textContent = "Invalid firmware file.";
        }
      });
  },
  
  updateUI: function() {
    const e = this.elements;
    
    if (e.sysCurrentROM) {
      e.sysCurrentROM.textContent = VK.currentFirmware ? VK.currentFirmware.profile : "None";
    }
    
    if (e.profileCodeText) {
      e.profileCodeText.textContent = VK.currentFirmware ? VK.currentFirmware.profile : "NONE";
    }
    
    if (e.romStatusText) {
      e.romStatusText.textContent = VK.currentFirmware ? VK.currentFirmware.profile + " ACTIVE" : "NONE";
    }
    
    if (e.logContent) {
      e.logContent.textContent = VK.logBuffer.join("\n");
      e.logContent.scrollTop = e.logContent.scrollHeight;
    }
  }
};
