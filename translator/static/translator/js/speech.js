/* Viva La Vida — text-to-speech for the current sentence */
(function () {
  'use strict';

  var state = {
    pending: null,
    speaking: false,
  };

  function speak(text) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn('Speech synthesis is not available in this browser.');
      return;
    }

    window.speechSynthesis.cancel();

    if (!text || !text.trim()) {
      return;
    }

    var utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onend = function () {
      state.speaking = false;
      state.pending = null;
    };
    utterance.onerror = function () {
      state.speaking = false;
      state.pending = null;
    };

    state.speaking = true;
    state.pending = text;
    window.speechSynthesis.speak(utterance);
  }

  function stop() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    window.speechSynthesis.cancel();
    state.speaking = false;
    state.pending = null;
  }

  function isSpeaking() {
    return state.speaking;
  }

  function getPending() {
    return state.pending;
  }

  if (typeof window !== 'undefined') {
    window.__vivaLaVidaSpeech = {
      speak: speak,
      stop: stop,
      isSpeaking: isSpeaking,
      getPending: getPending,
    };
  }
})();
