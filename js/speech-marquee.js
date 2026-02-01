// speech-marquee.js — Speech recognition display with color-coded words
// Red: upcoming (not yet spoken), Yellow: in-progress, Green: recognized

const SpeechMarquee = {
  element: null,
  recognition: null,
  
  // Current phrase words and their states
  words: [],
  currentWordIndex: 0,
  
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
  
  // Set the phrase to display (from firmware questions)
  setPhrase: function(phrase) {
    this.words = phrase.toUpperCase().split(/\s+/).map(word => ({
      text: word,
      state: 'upcoming'
    }));
    this.currentWordIndex = 0;
    this.render();
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
    
    // Match spoken words against our phrase
    this.matchWords(spokenWords, isFinal);
    this.render();
  },
  
  // Match spoken words to phrase words
  matchWords: function(spokenWords, isFinal) {
    // Reset in-progress states
    this.words.forEach(w => {
      if (w.state === 'in-progress') {
        w.state = 'upcoming';
      }
    });
    
    // Find matches
    let phraseIdx = 0;
    for (let i = 0; i < spokenWords.length && phraseIdx < this.words.length; i++) {
      const spoken = spokenWords[i].replace(/[^A-Z]/g, '');
      const target = this.words[phraseIdx].text.replace(/[^A-Z]/g, '');
      
      if (spoken === target) {
        if (isFinal) {
          this.words[phraseIdx].state = 'recognized';
        } else {
          this.words[phraseIdx].state = 'in-progress';
        }
        phraseIdx++;
      } else if (target.startsWith(spoken) && spoken.length > 0) {
        // Partial match
        this.words[phraseIdx].state = 'in-progress';
      }
    }
    
    this.currentWordIndex = phraseIdx;
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
  
  // Render the marquee
  render: function() {
    if (!this.element) return;
    
    this.element.innerHTML = this.words.map(w => 
      `<span class="word ${w.state}">${w.text}</span>`
    ).join('');
  },
  
  // Clear the marquee
  clear: function() {
    this.words = [];
    if (this.element) {
      this.element.innerHTML = '';
    }
  }
};
