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
  
  // Microphone uses VK.analyserNode from shared.js
  
  // Smoothed levels
  leftLevel: 0,
  rightLevel: 0,
  
  init: function(leftId, rightId) {
    this.leftMeter = document.getElementById(leftId);
    this.rightMeter = document.getElementById(rightId);
    
    if (this.leftMeter) {
      this.leftSegments = Array.from(this.leftMeter.querySelectorAll(".vu-segment"));
    }
    if (this.rightMeter) {
      this.rightSegments = Array.from(this.rightMeter.querySelectorAll(".vu-segment"));
    }
    
    // Try to set up playback monitoring (left meter)
    this.initPlaybackMonitor();
  },
  
  initPlaybackMonitor: function() {
    // Create audio context for monitoring playback
    // This requires an audio element or destination
    if (!VK.audioContext) return;
    
    this.playbackAnalyser = VK.audioContext.createAnalyser();
    this.playbackAnalyser.fftSize = 256;
    this.playbackDataArray = new Uint8Array(this.playbackAnalyser.fftSize);
    
    // Connect to destination to monitor output
    // Note: Direct output monitoring requires specific browser APIs
    // For now, we'll simulate or use a media element if available
  },
  
  // Connect an audio element to the playback monitor
  connectAudioElement: function(audioEl) {
    if (!VK.audioContext || !this.playbackAnalyser) return;
    
    const src = VK.audioContext.createMediaElementSource(audioEl);
    src.connect(this.playbackAnalyser);
    this.playbackAnalyser.connect(VK.audioContext.destination);
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
      const baseColor = seg.dataset.baseColor || seg.style.background;
      if (!seg.dataset.baseColor) {
        seg.dataset.baseColor = baseColor;
      }
      
      if (i < numLit) {
        // Lit segment - use full color
        seg.style.opacity = "1";
      } else {
        // Unlit segment - dim
        seg.style.opacity = "0.15";
      }
    });
  },
  
  update: function() {
    // Right meter: microphone input (uses VK's analyser)
    if (VK.analyserNode && VK.audioDataArray) {
      const micRms = this.getRmsLevel(VK.analyserNode, VK.audioDataArray);
      // Smooth and amplify
      this.rightLevel = this.rightLevel * 0.7 + (micRms * 5) * 0.3;
      this.rightLevel = Math.min(1, this.rightLevel);
      this.updateMeterDisplay(this.rightSegments, this.rightLevel);
    } else {
      // No mic - show idle
      this.updateMeterDisplay(this.rightSegments, 0);
    }
    
    // Left meter: playback output
    if (this.playbackAnalyser && this.playbackDataArray) {
      const playRms = this.getRmsLevel(this.playbackAnalyser, this.playbackDataArray);
      this.leftLevel = this.leftLevel * 0.7 + (playRms * 5) * 0.3;
      this.leftLevel = Math.min(1, this.leftLevel);
      this.updateMeterDisplay(this.leftSegments, this.leftLevel);
    } else {
      // No playback source - show idle
      this.updateMeterDisplay(this.leftSegments, 0);
    }
  },
  
  // Simulate playback level (for testing without audio element)
  setPlaybackLevel: function(level) {
    this.leftLevel = level;
    this.updateMeterDisplay(this.leftSegments, level);
  }
};
