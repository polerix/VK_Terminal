// speech-marquee.js — Speech recognition display with color-coded words
// Red: upcoming (not yet spoken), Yellow: in-progress, Green: recognized
// Scrolls to keep current word centered, recognized words disappear left

const SpeechMarquee = {
  element: null,
  track: null,
  recognition: null,
  
  // Current phrase words and their states
  words: [],
  recognizedCount: 0,
  currentWordIndex: 0,
  
  // Question queue
  questions: [],
  currentQuestionIdx: 0,
  
  // Word elements for measuring
  wordElements: [],
  
  init: function(elementId) {
    this.element = document.getElementById(elementId);
    if (!this.element) {
      console.error("SpeechMarquee: Element not found:", elementId);
      return;
    }
    
    // Create inner track for scrolling
    this.track = document.createElement('div');
    this.track.className = 'speech-marquee-track';
    this.element.appendChild(this.track);
    
    // Check for speech recognition support
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
  
  // Load questions from firmware
  loadQuestions: function(firmware) {
    if (firmware?.questions) {
      this.questions = firmware.questions.map(q => q.text);
      this.currentQuestionIdx = 0;
    }
  },
  
  // Set the phrase to display
  setPhrase: function(phrase) {
    this.words = phrase.toUpperCase().split(/\s+/).map(word => ({
      text: word,
      state: 'upcoming'
    }));
    this.recognizedCount = 0;
    this.currentWordIndex = 0;
    
    // Mark first word as in-progress
    if (this.words.length > 0) {
      this.words[0].state = 'in-progress';
    }
    
    this.render();
  },
  
  // Load next question
  nextQuestion: function() {
    if (this.questions.length === 0) return false;
    
    this.currentQuestionIdx = (this.currentQuestionIdx + 1) % this.questions.length;
    this.setPhrase(this.questions[this.currentQuestionIdx]);
    return true;
  },
  
  // Start with first question
  startSequence: function() {
    if (this.questions.length > 0) {
      this.currentQuestionIdx = 0;
      this.setPhrase(this.questions[0]);
    }
    this.start();
  },
  
  // Start listening
  start: function() {
    if (!this.recognition) return;
    try {
      this.recognition.start();
      console.log("SpeechMarquee: Started listening");
    } catch (e) {
      console.warn("SpeechMarquee: Could not start", e);
    }
  },
  
  // Stop listening
  stop: function() {
    if (!this.recognition) return;
    try {
      this.recognition.stop();
    } catch (e) {}
  },
  
  // Handle speech recognition results
  handleResult: function(event) {
    const lastResult = event.results[event.results.length - 1];
    const transcript = lastResult[0].transcript.toUpperCase().trim();
    const isFinal = lastResult.isFinal;
    
    const spokenWords = transcript.split(/\s+/);
    
    this.matchWords(spokenWords, isFinal);
    this.updateDisplay();
    
    // Check if phrase is complete
    if (this.recognizedCount >= this.words.length) {
      setTimeout(() => this.nextQuestion(), 1500);
    }
  },
  
  // Match spoken words - advances through phrase
  matchWords: function(spokenWords, isFinal) {
    // Reset in-progress states
    this.words.forEach((w, i) => {
      if (i >= this.recognizedCount && w.state !== 'recognized') {
        w.state = 'upcoming';
      }
    });
    
    let matchIdx = this.recognizedCount;
    
    for (let i = 0; i < spokenWords.length && matchIdx < this.words.length; i++) {
      const spoken = spokenWords[i].replace(/[^A-Z]/g, '');
      const target = this.words[matchIdx].text.replace(/[^A-Z]/g, '');
      
      if (spoken === target) {
        if (isFinal) {
          this.words[matchIdx].state = 'recognized';
          this.recognizedCount = matchIdx + 1;
          matchIdx++;
        } else {
          this.words[matchIdx].state = 'in-progress';
          this.currentWordIndex = matchIdx;
        }
      } else if (target.startsWith(spoken) && spoken.length > 1) {
        this.words[matchIdx].state = 'in-progress';
        this.currentWordIndex = matchIdx;
      } else if (isFinal && i > 0) {
        // Skip word on mismatch after progress
        this.words[matchIdx].state = 'recognized';
        this.recognizedCount = matchIdx + 1;
        matchIdx++;
      }
    }
    
    // Set current word in-progress if nothing matched
    if (this.recognizedCount < this.words.length) {
      this.currentWordIndex = this.recognizedCount;
      if (this.words[this.currentWordIndex].state === 'upcoming') {
        this.words[this.currentWordIndex].state = 'in-progress';
      }
    }
  },
  
  handleError: function(event) {
    console.warn("SpeechMarquee: Error", event.error);
  },
  
  handleEnd: function() {
    if (VK.analysisRunning) {
      setTimeout(() => this.start(), 100);
    }
  },
  
  // Render the marquee - creates word elements
  render: function() {
    if (!this.track) return;
    
    this.track.innerHTML = this.words.map((w, i) => 
      `<span class="word ${w.state}" data-idx="${i}">${w.text}</span>`
    ).join('');
    
    this.wordElements = Array.from(this.track.querySelectorAll('.word'));
    
    // Scroll after DOM update
    requestAnimationFrame(() => this.scrollToCurrentWord());
  },
  
  // Update display without full re-render (just update classes and scroll)
  updateDisplay: function() {
    if (!this.track || this.wordElements.length !== this.words.length) {
      this.render();
      return;
    }
    
    // Update classes on existing elements
    this.words.forEach((w, i) => {
      if (this.wordElements[i]) {
        this.wordElements[i].className = `word ${w.state}`;
      }
    });
    
    this.scrollToCurrentWord();
  },
  
  // Scroll to keep current word centered
  scrollToCurrentWord: function() {
    if (!this.element || !this.track || this.wordElements.length === 0) return;
    
    const containerWidth = this.element.offsetWidth;
    if (containerWidth === 0) return; // Not visible yet
    
    const centerTarget = containerWidth / 2;
    
    // Find the current word element
    const currentEl = this.wordElements[this.currentWordIndex];
    if (!currentEl) return;
    
    // Calculate offset to center current word
    const wordLeft = currentEl.offsetLeft;
    const wordWidth = currentEl.offsetWidth;
    const wordCenter = wordLeft + wordWidth / 2;
    
    const offset = centerTarget - wordCenter;
    
    this.track.style.transform = `translateX(${offset}px)`;
  },
  
  // Clear the marquee
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
