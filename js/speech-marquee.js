// speech-marquee.js — Speech recognition display with color-coded words
// Red: upcoming, Yellow: in-progress (read head), Green: recognized
// Arrow keys move the read head, scroll follows

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
  baseSpeed: 10,
  catchUpSpeed: 25,
  animating: false,
  
  // Key hold for read head advancement
  leftHeld: false,
  rightHeld: false,
  holdTimer: 0,
  holdDelay: 150,          // ms between word advances when holding
  lastAdvance: 0,
  
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
    
    document.addEventListener('keydown', (e) => this.handleKeydown(e));
    document.addEventListener('keyup', (e) => this.handleKeyup(e));
  },
  
  handleKeydown: function(e) {
    if (!this.animating) return;
    
    switch (e.key) {
      case 'ArrowRight':
        if (!this.rightHeld) {
          this.rightHeld = true;
          this.advanceReadHead(1);
        }
        e.preventDefault();
        break;
      case 'ArrowLeft':
        if (!this.leftHeld) {
          this.leftHeld = true;
          this.advanceReadHead(-1);
        }
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
        break;
      case 'ArrowLeft':
        this.leftHeld = false;
        break;
    }
  },
  
  // Move the read head (yellow word) forward or back
  advanceReadHead: function(direction) {
    const newIndex = this.currentWordIndex + direction;
    
    if (newIndex >= 0 && newIndex < this.words.length) {
      // Update word states
      if (direction > 0) {
        // Moving forward - mark current as recognized
        this.words[this.currentWordIndex].state = 'recognized';
        this.recognizedCount = Math.max(this.recognizedCount, this.currentWordIndex + 1);
      } else {
        // Moving back - mark new position as in-progress, current as upcoming
        this.words[this.currentWordIndex].state = 'upcoming';
      }
      
      this.currentWordIndex = newIndex;
      this.words[this.currentWordIndex].state = 'in-progress';
      
      this.updateClasses();
      this.calculateTargetOffset();
    } else if (newIndex >= this.words.length) {
      // End of line - go to next question
      this.nextQuestion();
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
    
    this.buildTrack();
  },
  
  buildTrack: function() {
    if (!this.track) return;
    
    this.track.innerHTML = this.words.map((w, i) => 
      `<span class="word ${w.state}" data-idx="${i}">${w.text}</span>`
    ).join(' ');
    
    this.wordElements = Array.from(this.track.querySelectorAll('.word'));
    
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
  
  animate: function() {
    if (!this.animating) return;
    
    const now = performance.now();
    
    // Handle held keys - advance read head repeatedly
    if (this.rightHeld && now - this.lastAdvance > this.holdDelay) {
      this.advanceReadHead(1);
      this.lastAdvance = now;
      // Speed up the longer you hold
      this.holdDelay = Math.max(50, this.holdDelay - 10);
    } else if (this.leftHeld && now - this.lastAdvance > this.holdDelay) {
      this.advanceReadHead(-1);
      this.lastAdvance = now;
      this.holdDelay = Math.max(50, this.holdDelay - 10);
    } else if (!this.rightHeld && !this.leftHeld) {
      // Reset hold delay when not holding
      this.holdDelay = 150;
    }
    
    // Scroll towards target (where read head is)
    const distance = this.targetOffset - this.currentOffset;
    const absDistance = Math.abs(distance);
    
    let speed = this.baseSpeed;
    if (absDistance > 100) {
      speed = this.catchUpSpeed;
    } else if (absDistance > 30) {
      speed = this.baseSpeed * 1.5;
    }
    
    if (absDistance > 0.5) {
      const direction = distance > 0 ? 1 : -1;
      const move = Math.min(speed, absDistance) * direction;
      this.currentOffset += move;
      this.track.style.transform = `translateX(${this.currentOffset}px)`;
    }
    
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
    // Only update words at or after current read head
    let matchIdx = this.currentWordIndex;
    
    for (let s = 0; s < spokenWords.length && matchIdx < this.words.length; s++) {
      const spoken = spokenWords[s].replace(/[^A-Z]/g, '');
      if (!spoken) continue;
      
      const target = this.words[matchIdx].text.replace(/[^A-Z]/g, '');
      
      if (spoken === target) {
        if (isFinal) {
          this.words[matchIdx].state = 'recognized';
          this.recognizedCount = matchIdx + 1;
          // Advance read head
          if (matchIdx === this.currentWordIndex && matchIdx + 1 < this.words.length) {
            this.currentWordIndex = matchIdx + 1;
            this.words[this.currentWordIndex].state = 'in-progress';
          }
        } else {
          this.words[matchIdx].state = 'in-progress';
        }
        matchIdx++;
      } else if (target.startsWith(spoken) && spoken.length > 1) {
        this.words[matchIdx].state = 'in-progress';
      }
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
    this.leftHeld = false;
    this.rightHeld = false;
    this.holdDelay = 150;
    this.stopAnimation();
    if (this.track) {
      this.track.innerHTML = '';
      this.track.style.transform = '';
    }
  }
};
