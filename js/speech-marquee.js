// speech-marquee.js — Speech recognition display with color-coded words
// Red: upcoming (not yet spoken), Yellow: in-progress, Green: recognized
// Text scrolls left-to-right, recognition advances right-to-left

const SpeechMarquee = {
  element: null,
  recognition: null,
  
  // Current phrase words and their states
  words: [],
  recognizedCount: 0,
  
  // Question queue
  questions: [],
  currentQuestionIndex: 0,
  
  // States: 'upcoming', 'in-progress', 'recognized'
  
  init: function(elementId) {
    this.element = document.getElementById(elementId);
    if (!this.element) return;
    
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
      this.currentQuestionIndex = 0;
    }
  },
  
  // Set the phrase to display
  setPhrase: function(phrase) {
    this.words = phrase.toUpperCase().split(/\s+/).map(word => ({
      text: word,
      state: 'upcoming'
    }));
    this.recognizedCount = 0;
    this.render();
  },
  
  // Load next question
  nextQuestion: function() {
    if (this.questions.length === 0) return false;
    
    this.currentQuestionIndex = (this.currentQuestionIndex + 1) % this.questions.length;
    this.setPhrase(this.questions[this.currentQuestionIndex]);
    return true;
  },
  
  // Start with first question
  startSequence: function() {
    if (this.questions.length > 0) {
      this.currentQuestionIndex = 0;
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
    // Get the latest result
    const lastResult = event.results[event.results.length - 1];
    const transcript = lastResult[0].transcript.toUpperCase().trim();
    const isFinal = lastResult.isFinal;
    
    // Split into words
    const spokenWords = transcript.split(/\s+/);
    
    // Match spoken words against our phrase (right to left advancement)
    this.matchWords(spokenWords, isFinal);
    this.render();
    
    // Check if phrase is complete
    if (this.recognizedCount >= this.words.length) {
      setTimeout(() => this.nextQuestion(), 1000);
    }
  },
  
  // Match spoken words to phrase words
  // Recognition advances from right to left (first word to last)
  matchWords: function(spokenWords, isFinal) {
    // Reset in-progress states for unrecognized words
    this.words.forEach((w, i) => {
      if (i >= this.recognizedCount && w.state === 'in-progress') {
        w.state = 'upcoming';
      }
    });
    
    // Count total spoken words to determine progress
    let spokenIdx = 0;
    
    for (let i = this.recognizedCount; i < this.words.length && spokenIdx < spokenWords.length; i++) {
      const spoken = spokenWords[spokenIdx].replace(/[^A-Z]/g, '');
      const target = this.words[i].text.replace(/[^A-Z]/g, '');
      
      if (spoken === target) {
        // Full match
        if (isFinal) {
          this.words[i].state = 'recognized';
          this.recognizedCount = i + 1;
        } else {
          this.words[i].state = 'in-progress';
        }
        spokenIdx++;
      } else if (target.startsWith(spoken) && spoken.length > 1) {
        // Partial match - mark in progress
        this.words[i].state = 'in-progress';
        spokenIdx++;
      } else if (isFinal && spokenIdx > 0) {
        // Skip unmatched word if we've made progress
        this.words[i].state = 'recognized';
        this.recognizedCount = i + 1;
      }
    }
  },
  
  handleError: function(event) {
    console.warn("SpeechMarquee: Error", event.error);
  },
  
  handleEnd: function() {
    // Restart if analysis is running
    if (VK.analysisRunning) {
      setTimeout(() => this.start(), 100);
    }
  },
  
  // Render the marquee - scrolls left to right
  // Recognized words disappear from left, upcoming words on right
  render: function() {
    if (!this.element) return;
    
    // Build HTML - recognized words fade/disappear, upcoming stay visible
    const html = this.words.map((w, i) => {
      let classes = `word ${w.state}`;
      return `<span class="${classes}">${w.text}</span>`;
    }).join('');
    
    this.element.innerHTML = html;
  },
  
  // Clear the marquee
  clear: function() {
    this.words = [];
    this.recognizedCount = 0;
    if (this.element) {
      this.element.innerHTML = '';
    }
  }
};
