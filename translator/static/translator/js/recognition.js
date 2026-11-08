/* Viva La Vida — ISL recognition sub-module (placeholder integration point).
 *
 * The trained model has not been deployed to this project yet. When a trained
 * MediaPipe-style ISL recognizer ships, replace the adapter below with the
 * real model loader. This keeps the homepage honest: without a model it never
 * claims a sign has been recognized.
 */
(function () {
  'use strict';

  var state = {
    ready: false,
    error: null,
  };

  function load() {
    if (state.ready) {
      return Promise.resolve();
    }
    return Promise.resolve()
      .then(function () {
        if (typeof model === 'undefined' || !model) {
          throw new Error('ISL recognition model not configured');
        }
        return true;
      });
  }

  function predict(landmarks) {
    return {
      label: '—',
      confidence: 0,
    };
  }

  function isReady() {
    return state.ready;
  }

  function onRecognized(label, confidence) {
    // Override hook that the homepage calls after a successful remote
    // recognition. Default no-op; the homepage wires its own behaviour.
  }

  if (typeof window !== 'undefined') {
    window.__vivaLaVidaRecognition = {
      load: load,
      predict: predict,
      isReady: isReady,
      onRecognized: onRecognized,
      state: state,
    };
  }
})();
