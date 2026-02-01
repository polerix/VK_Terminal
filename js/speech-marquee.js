// speech-marquee.js — Speech recognition display with color-coded words
// Red: upcoming, Yellow: in-progress (centered), Green: recognized
// Auto-scrolls continuously, speeds up when recognition catches up
// Arrow keys: Left/Right = speed (hold to accelerate), Up/Down = prev/next question

const SpeechMarquee = {
  element: null,
  track: null,
  recognition: null,
  
  words: [],
  recognizedCount: 0,
  currentWordIndex: 0,
  
  questions: [],
  currentQuestionIdx: 0,
  
  wordElements: [],
  isListening: false,
  
  // Scrolling state
  currentOffset: 0,
  targetOffset: 0,
  baseSpeed: 10,           // Base pixels per frame
  scrollSpeed: 10,         // Current speed (adjustable)
  catchUpSpeed: 20,        // Speed when catching up (2x base)
  animating: false,
  
  // Key hold acceleration
  leftHeld: false,
  rightHeld: false,
  holdAccel: 0,            // Acceleration from holding keys
  accelRate: 0.5,          // How fast acceleration builds
  maxAccel: 50,            // Maximum acceleration
  
  init: function(elementId) {
    this.element = document.getElementById(elementId);
    if (!this.element) return;
    
    this.track = document.createElement('div');
    this.track.className = 'speech-marquee-track';
    this.element.appendChild(this.track);
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("SpeechMarquee: Speech recognition not supported");
      return;
    }
    
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    
    this.recognition.onresult = (event) => this.handleResult(event);
    this.recognition.onerror = (event) => this.handleError(event);
    this.recognition.onend = () => this.handleEnd();
    
    // Keyboard controls
    document.addEventListener('keydown', (e) => this.handleKeydown(e));
    document.addEventListener('keyup', (e) => this.handleKeyup(e));
  },
  
  handleKeydown: function(e) {
    if (!this.animating) return;
    
    switch (e.key) {
      case 'ArrowRight':
        this.rightHeld = true;
        e.preventDefault();
        break;
      case 'ArrowLeft':
        this.leftHeld = true;
        e.preventDefault();
        break;
      case 'ArrowUp':
        this.prevQuestion();
        e.preventDefault();
        break;
      case 'ArrowDown':
        this.nextQuestion();
        e.preventDefault();
        break;
    }
  },
  
  handleKeyup: function(e) {
    switch (e.key) {
      case 'ArrowRight':
        this.rightHeld = false;
        this.holdAccel = 0;
        break;
      case 'ArrowLeft':
        this.leftHeld = false;
        this.holdAccel = 0;
        break;
    }
  },
  
  loadQuestions: function(firmware) {
    if (firmware?.questions) {
      this.questions = firmware.questions.map(q => q.text);
      this.currentQuestionIdx = 0;
    }
  },
  
  setPhrase: function(phrase) {
    this.words = phrase.toUpperCase().split(/\s+/).map(word => ({
      text: word,
      state: 'upcoming'
    }));
    this.recognizedCount = 0;
    this.currentWordIndex = 0;
    
    if (this.words.length > 0) {
      this.words[0].state = 'in-progress';
    }
    
    // Reset speed and acceleration
    this.scrollSpeed = this.baseSpeed;
    this.holdAccel = 0;
    
    this.buildTrack();
  },
  
  buildTrack: function() {
    if (!this.track) return;
    
    this.track.innerHTML = this.words.map((w, i) => 
      `<span class="word ${w.state}" data-idx="${i}">${w.text}</span>`
    ).join(' ');
    
    this.wordElements = Array.from(this.track.querySelectorAll('.word'));
    
    // Reset scroll position - start from right edge
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const containerWidth = this.element.offsetWidth;
        this.currentOffset = containerWidth - 50;
        this.targetOffset = this.currentOffset;
        this.track.style.transform = `translateX(${this.currentOffset}px)`;
        this.calculateTargetOffset();
      });
    });
  },
  
  calculateTargetOffset: function() {
    if (!this.element || this.wordElements.length === 0) return;
    
    const containerWidth = this.element.offsetWidth;
    const centerX = containerWidth / 2;
    
    const currentEl = this.wordElements[this.currentWordIndex];
    if (!currentEl) return;
    
    const wordLeft = currentEl.offsetLeft;
    const wordWidth = currentEl.offsetWidth;
    const wordCenter = wordLeft + (wordWidth / 2);
    
    this.targetOffset = centerX - wordCenter;
  },
  
  // Animation loop - always scrolling
  animate: function() {
    if (!this.animating) return;
    
    // Build up acceleration while keys held
    if (this.rightHeld) {
      this.holdAccel = Math.min(this.holdAccel + this.accelRate, this.maxAccel);
    } else if (this.leftHeld) {
      this.holdAccel = Math.min(this.holdAccel + this.accelRate, this.maxAccel);
    }
    
    const distance = this.targetOffset - this.currentOffset;
    const absDistance = Math.abs(distance);
    
    // Calculate effective speed
    let speed = this.baseSpeed;
    
    // Apply key-based acceleration
    if (this.rightHeld) {
      // Speed up forward
      speed = this.baseSpeed + this.holdAccel;
    } else if (this.leftHeld) {
      // Reverse with acceleration
      speed = -(this.baseSpeed + this.holdAccel);
    } else if (absDistance > 50) {
      // Catch up when far behind
      speed = this.catchUpSpeed;
    } else if (absDistance > 20) {
      speed = this.baseSpeed * 1.5;
    }
    
    // Move based on speed
    if (this.rightHeld || this.leftHeld) {
      // Manual control - direct movement
      this.currentOffset -= speed; // Negative because moving track left = text scrolls right
      // Update target to current position so it doesn't bounce back
      this.targetOffset = this.currentOffset;
    } else if (absDistance > 0.5) {
      // Auto-scroll towards target
      const direction = distance > 0 ? 1 : -1;
      const move = Math.min(Math.abs(speed), absDistance) * direction;
      this.currentOffset += move;
    }
    
    this.track.style.transform = `translateX(${this.currentOffset}px)`;
    
    requestAnimationFrame(() => this.animate());
  },
  
  startAnimation: function() {
    if (this.animating) return;
    this.animating = true;
    this.animate();
  },
  
  stopAnimation: function() {
    this.animating = false;
  },
  
  prevQuestion: function() {
    if (this.questions.length === 0) return;
    this.currentQuestionIdx--;
    if (this.currentQuestionIdx < 0) {
      this.currentQuestionIdx = this.questions.length - 1;
    }
    this.setPhrase(this.questions[this.currentQuestionIdx]);
  },
  
  nextQuestion: function() {
    if (this.questions.length === 0) return;
    this.currentQuestionIdx = (this.currentQuestionIdx + 1) % this.questions.length;
    this.setPhrase(this.questions[this.currentQuestionIdx]);
  },
  
  startSequence: function() {
    if (this.questions.length > 0) {
      this.currentQuestionIdx = 0;
      this.setPhrase(this.questions[0]);
    }
    this.start();
    this.startAnimation();
  },
  
  start: function() {
    if (!this.recognition) return;
    this.isListening = true;
    try {
      this.recognition.start();
    } catch (e) {}
  },
  
  stop: function() {
    this.isListening = false;
    this.stopAnimation();
    if (!this.recognition) return;
    try {
      this.recognition.stop();
    } catch (e) {}
  },
  
  handleResult: function(event) {
    const lastResult = event.results[event.results.length - 1];
    const transcript = lastResult[0].transcript.toUpperCase().trim();
    const isFinal = lastResult.isFinal;
    
    const spokenWords = transcript.split(/\s+/);
    this.matchWords(spokenWords, isFinal);
    this.updateClasses();
    this.calculateTargetOffset();
    
    if (this.recognizedCount >= this.words.length) {
      setTimeout(() => this.nextQuestion(), 800);
    }
  },
  
  matchWords: function(spokenWords, isFinal) {
    for (let i = this.recognizedCount; i < this.words.length; i++) {
      if (this.words[i].state !== 'recognized') {
        this.words[i].state = 'upcoming';
      }
    }
    
    let matchIdx = this.recognizedCount;
    
    for (let s = 0; s < spokenWords.length && matchIdx < this.words.length; s++) {
      const spoken = spokenWords[s].replace(/[^A-Z]/g, '');
      if (!spoken) continue;
      
      const target = this.words[matchIdx].text.replace(/[^A-Z]/g, '');
      
      if (spoken === target) {
        if (isFinal) {
          this.words[matchIdx].state = 'recognized';
          this.recognizedCount = matchIdx + 1;
        } else {
          this.words[matchIdx].state = 'in-progress';
        }
        this.currentWordIndex = matchIdx;
        matchIdx++;
      } else if (target.startsWith(spoken) && spoken.length > 1) {
        this.words[matchIdx].state = 'in-progress';
        this.currentWordIndex = matchIdx;
      } else if (isFinal) {
        this.words[matchIdx].state = 'recognized';
        this.recognizedCount = matchIdx + 1;
        matchIdx++;
      }
    }
    
    if (this.recognizedCount < this.words.length) {
      this.currentWordIndex = this.recognizedCount;
      this.words[this.currentWordIndex].state = 'in-progress';
    }
  },
  
  updateClasses: function() {
    this.words.forEach((w, i) => {
      if (this.wordElements[i]) {
        this.wordElements[i].className = `word ${w.state}`;
      }
    });
  },
  
  handleError: function(event) {
    console.warn("SpeechMarquee:", event.error);
  },
  
  handleEnd: function() {
    if (this.isListening && VK.analysisRunning) {
      setTimeout(() => this.start(), 100);
    }
  },
  
  clear: function() {
    this.words = [];
    this.recognizedCount = 0;
    this.currentWordIndex = 0;
    this.wordElements = [];
    this.scrollSpeed = this.baseSpeed;
    this.holdAccel = 0;
    this.leftHeld = false;
    this.rightHeld = false;
    this.stopAnimation();
    if (this.track) {
      this.track.innerHTML = '';
      this.track.style.transform = '';
    }
  }
};
