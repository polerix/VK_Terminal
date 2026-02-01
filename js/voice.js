// voice.js — Voice Analyzer panel rendering

const VoicePanel = {
  canvas: null,
  ctx: null,
  
  init: function(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (this.canvas) {
      this.ctx = this.canvas.getContext("2d");
    }
  },
  
  draw: function() {
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!canvas || !ctx) return;
    
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

    // Check if we should draw active content
    if (!VK.hasToken || !VK.displayOn || VK.irisState !== "ACTIVE" || !VK.analysisRunning) {
      // Draw placeholder
      ctx.fillStyle = "#fff";
      ctx.font = "24px 'Arial Narrow', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("TYRELL CO.", w / 2, h / 2);
      return;
    }

    const gridTop = headerTop + 40;
    const gridBottom = h - 90;

    // Draw waveform if we have audio data
    if (VK.audioDataArray && VK.audioDataArray.length > 0) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < VK.audioDataArray.length; i++) {
        const v = (VK.audioDataArray[i] - 128) / 128;
        const x = (i / (VK.audioDataArray.length - 1)) * w;
        const y = gridTop + (gridBottom - gridTop) * (0.5 - v * 0.4);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Markers
    ctx.font = "16px 'Arial Narrow', sans-serif";
    ctx.textBaseline = "bottom";
    ctx.textAlign = "center";
    const cx = w / 2;
    const markerTop = gridTop - 8;
    ctx.fillStyle = "#fff";
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

    // Stress level
    const stress = VK.lastStress;
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

    // Deviation
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
};
