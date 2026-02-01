// speech-marquee.js — Speech recognition display with color-coded words
// Red: upcoming, Yellow: in-progress (centered), Green: recognized (scrolls left)

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
  
  init: function(elementId) {
    this.element = document.getElementById(elementId);
    if (!this.element) return;
    
    // Create inner track
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
    
    // Position after DOM ready
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.positionTrack();
      });
    });
  },
  
  positionTrack: function() {
    if (!this.element || !this.track || this.wordElements.length === 0) return;
    
    const containerWidth = this.element.offsetWidth;
    const trackWidth = this.track.scrollWidth;
    
    if (containerWidth === 0 || trackWidth === 0) return;
    
    // Find current word position
    const currentEl = this.wordElements[this.currentWordIndex];
    if (!currentEl) return;
    
    const wordLeft = currentEl.offsetLeft;
    const wordWidth = currentEl.offsetWidth;
    const wordCenter = wordLeft + (wordWidth / 2);
    
    // Center the current word in the container
    const centerX = containerWidth / 2;
    const offset = centerX - wordCenter;
    
    this.track.style.transform = `translateX(${offset}px)`;
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
    this.positionTrack();
    
    // Check if complete
    if (this.recognizedCount >= this.words.length) {
      setTimeout(() => this.nextQuestion(), 1200);
    }
  },
  
  matchWords: function(spokenWords, isFinal) {
    // Reset non-recognized words to upcoming
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
        // Skip on mismatch
        this.words[matchIdx].state = 'recognized';
        this.recognizedCount = matchIdx + 1;
        matchIdx++;
      }
    }
    
    // Mark current as in-progress
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
    if (this.track) {
      this.track.innerHTML = '';
      this.track.style.transform = '';
    }
  }
};
