// speech-marquee.js — Speech recognition display with color-coded words
// Red: upcoming, Yellow: in-progress (centered), Green: recognized
// Auto-scrolls continuously, speeds up when recognition catches up

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
  scrollSpeed: 1.5,        // Base pixels per frame
  catchUpSpeed: 6,         // Speed when catching up (2x base)
  animating: false,
  
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
    
    // Reset scroll position - start from right edge
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const containerWidth = this.element.offsetWidth;
        // Start with first word at the right edge
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
    
    // Calculate distance to target
    const distance = this.targetOffset - this.currentOffset;
    const absDistance = Math.abs(distance);
    
    // Determine speed - 2x when catching up to recognized words
    let speed = this.scrollSpeed;
    if (absDistance > 30) {
      speed = this.catchUpSpeed;
    } else if (absDistance > 10) {
      speed = this.scrollSpeed * 1.5;
    }
    
    // Move towards target
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
    this.stopAnimation();
    if (this.track) {
      this.track.innerHTML = '';
      this.track.style.transform = '';
    }
  }
};
