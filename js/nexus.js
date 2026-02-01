// nexus.js — Nexus Gen Probability panel rendering

const NexusPanel = {
  canvas: null,
  ctx: null,
  phase: 0,
  points: [],
  
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

    // Grid
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

    // Labels
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

    // Active content only when running
    if (!VK.hasToken || !VK.displayOn || VK.irisState !== "ACTIVE" || !VK.analysisRunning) return;

    // Red mean line
    const meanY = gridTop + (gridBottom - gridTop) * (0.5 + 0.05 * Math.sin(this.phase));
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
      this.points.push({
        x: px,
        y: py,
        confidence: conf,
        createdAt: performance.now() / 1000
      });
    }

    const now = performance.now() / 1000;
    for (let i = this.points.length - 1; i >= 0; i--) {
      const p = this.points[i];
      const age = now - p.createdAt;
      const isHigh = p.confidence >= 0.8;
      const life = isHigh ? 20 : 10;
      if (age > life) {
        this.points.splice(i, 1);
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

    this.phase += 0.03;
  }
};
