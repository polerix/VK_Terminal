// vu-meters.js — VU meter audio visualization
// Left: local playback, Right: microphone input

const VUMeters = {
  // DOM refs
  leftMeter: null,
  rightMeter: null,
  leftSegments: [],
  rightSegments: [],
  
  // Audio nodes for playback monitoring
  playbackAnalyser: null,
  playbackDataArray: null,
  
  // Own analyser for mic (separate from VK's to ensure always-on)
  micAnalyser: null,
  micDataArray: null,
  
  // Smoothed levels
  leftLevel: 0,
  rightLevel: 0,
  
  // Track if we've connected
  micConnected: false,
  playbackConnected: false,
  
  init: function(leftId, rightId) {
    this.leftMeter = document.getElementById(leftId);
    this.rightMeter = document.getElementById(rightId);
    
    if (this.leftMeter) {
      this.leftSegments = Array.from(this.leftMeter.querySelectorAll(".vu-segment"));
    }
    if (this.rightMeter) {
      this.rightSegments = Array.from(this.rightMeter.querySelectorAll(".vu-segment"));
    }
  },
  
  // Setup mic analyser when audio context is available
  setupMicAnalyser: function() {
    if (this.micConnected) return;
    if (!VK.audioContext || !VK.mediaStream) return;
    
    try {
      this.micAnalyser = VK.audioContext.createAnalyser();
      this.micAnalyser.fftSize = 256;
      this.micDataArray = new Uint8Array(this.micAnalyser.fftSize);
      
      const src = VK.audioContext.createMediaStreamSource(VK.mediaStream);
      src.connect(this.micAnalyser);
      // Don't connect to destination - just analyse
      
      this.micConnected = true;
      console.log("VU: Microphone connected");
    } catch (e) {
      console.warn("VU: Failed to connect mic", e);
    }
  },
  
  // Setup playback analyser
  setupPlaybackAnalyser: function() {
    if (this.playbackConnected) return;
    if (!VK.audioContext) return;
    
    try {
      this.playbackAnalyser = VK.audioContext.createAnalyser();
      this.playbackAnalyser.fftSize = 256;
      this.playbackDataArray = new Uint8Array(this.playbackAnalyser.fftSize);
      
      this.playbackConnected = true;
      console.log("VU: Playback analyser ready");
    } catch (e) {
      console.warn("VU: Failed to setup playback", e);
    }
  },
  
  // Connect an audio element to the playback monitor
  connectAudioElement: function(audioEl) {
    if (!VK.audioContext) return;
    this.setupPlaybackAnalyser();
    if (!this.playbackAnalyser) return;
    
    try {
      const src = VK.audioContext.createMediaElementSource(audioEl);
      src.connect(this.playbackAnalyser);
      this.playbackAnalyser.connect(VK.audioContext.destination);
      console.log("VU: Audio element connected");
    } catch (e) {
      console.warn("VU: Failed to connect audio element", e);
    }
  },
  
  // Get RMS level from analyser
  getRmsLevel: function(analyser, dataArray) {
    if (!analyser || !dataArray) return 0;
    
    analyser.getByteTimeDomainData(dataArray);
    
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const v = (dataArray[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / dataArray.length);
  },
  
  // Update meter display based on level (0-1)
  updateMeterDisplay: function(segments, level) {
    const numLit = Math.round(level * segments.length);
    
    segments.forEach((seg, i) => {
      if (i < numLit) {
        seg.style.opacity = "1";
      } else {
        seg.style.opacity = "0.15";
      }
    });
  },
  
  update: function() {
    // Try to connect if not yet connected
    if (!this.micConnected && VK.audioContext && VK.mediaStream) {
      this.setupMicAnalyser();
    }
    if (!this.playbackConnected && VK.audioContext) {
      this.setupPlaybackAnalyser();
    }
    
    // Right meter: microphone input (always active when connected)
    if (this.micAnalyser && this.micDataArray) {
      const micRms = this.getRmsLevel(this.micAnalyser, this.micDataArray);
      this.rightLevel = this.rightLevel * 0.7 + (micRms * 5) * 0.3;
      this.rightLevel = Math.min(1, this.rightLevel);
      this.updateMeterDisplay(this.rightSegments, this.rightLevel);
    } else {
      this.updateMeterDisplay(this.rightSegments, 0);
    }
    
    // Left meter: loopback from mic (until actual playback audio is connected)
    if (this.micAnalyser && this.micDataArray) {
      const loopRms = this.getRmsLevel(this.micAnalyser, this.micDataArray);
      this.leftLevel = this.leftLevel * 0.7 + (loopRms * 5) * 0.3;
      this.leftLevel = Math.min(1, this.leftLevel);
      this.updateMeterDisplay(this.leftSegments, this.leftLevel);
    } else if (this.playbackAnalyser && this.playbackDataArray) {
      // Use actual playback if connected
      const playRms = this.getRmsLevel(this.playbackAnalyser, this.playbackDataArray);
      this.leftLevel = this.leftLevel * 0.7 + (playRms * 5) * 0.3;
      this.leftLevel = Math.min(1, this.leftLevel);
      this.updateMeterDisplay(this.leftSegments, this.leftLevel);
    } else {
      this.updateMeterDisplay(this.leftSegments, 0);
    }
  }
};
