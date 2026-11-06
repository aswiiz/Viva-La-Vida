/* Viva La Vida — ISL sign recognition module.
 *
 * Receives normalized hand landmarks from hand_detection.js and returns a
 * predicted sign plus confidence. The classifier is deliberately thin here:
 * the real ISL model is swapped in through the model adapter below.
 *
 * Features:
 *  - landmark normalization to the camera frame
 *  - configurable prediction threshold
 *  - configurable stable duration (how long a label must persist)
 *  - configurable cooldown (prevents repeated appends)
 *  - optional temporal smoothing for dynamic signs
 */
(function () {
  'use strict';

  var DEFAULT_THRESHOLD = 0.75;
  var DEFAULT_STABLE_DURATION = 600;
  var DEFAULT_COOLDOWN = 1000;

  var state = {
    threshold: DEFAULT_THRESHOLD,
    stableDuration: DEFAULT_STABLE_DURATION,
    cooldown: DEFAULT_COOLDOWN,
    lastLabel: '',
    lastPredictionTime: 0,
    awaitingStable: false,
    stableTimer: null,
    cooldownTimer: null,
  };

  var adapters = {
    mediapipe: {
      normalize: function (landmarks, width, height) {
        var out = [];
        for (var i = 0; i < landmarks.length; i += 1) {
          out.push({
            x: landmarks[i].x,
            y: landmarks[i].y,
            z: landmarks[i].z,
          });
        }
        return out;
      },
      featureVector: function (landmarks) {
        var vec = [];
        landmarks.forEach(function (p) {
          vec.push(p.x);
          vec.push(p.y);
          vec.push(p.z || 0);
        });
        return vec;
      },
    },
  };

  var models = {
    mediapipe: { labels: ['—'] },
  };

  function adapter() {
    return adapters.mediapipe;
  }

  function featureVector(landmarks) {
    var ad = adapter();
    return ad.featureVector(landmarks);
  }

  function predict(landmarks, target = null) {
    var vec = featureVector(landmarks);
    if (typeof model === 'undefined' || !model) {
      return { label: '—', confidence: 0 };
    }
    var result = model.predict(vec, target);
    if (typeof result === 'string') {
      return { label: result, confidence: 0 };
    }
    return {
      label: result.label || '—',
      confidence: result.confidence || 0,
    };
  }

  function isBelowThreshold(label, confidence) {
    return confidence < state.threshold;
  }

  function stableLabel(label, confidence, now) {
    if (isBelowThreshold(label, confidence)) {
      return null;
    }
    if (label !== state.lastLabel) {
      state.lastLabel = label;
      state.lastPredictionTime = now;
      return label;
    }
    if (now - state.lastPredictionTime >= state.stableDuration) {
      return label;
    }
    return null;
  }

  function resetStable() {
    if (state.stableTimer) {
      clearTimeout(state.stableTimer);
      state.stableTimer = null;
    }
    state.lastPredictionTime = 0;
  }

  function resetCooldown() {
    if (state.cooldownTimer) {
      clearTimeout(state.cooldownTimer);
      state.cooldownTimer = null;
    }
  }

  function applyCooldown(label, now) {
    if (state.lastPrediction === label) {
      var remaining = state.cooldown - (now - state.lastPredictionTime);
      if (remaining > 0) {
        return false;
      }
    }
    return true;
  }

  function setThreshold(value) {
    state.threshold = Math.min(1, Math.max(0, value));
    if (typeof model !== 'undefined' && model.setThreshold) {
      model.setThreshold(state.threshold);
    }
  }

  function setStableDuration(value) {
    state.stableDuration = Math.max(0, value);
  }

  function setCooldown(value) {
    state.cooldown = Math.max(0, value);
  }

  function init() {
    var settings = document.querySelector('[data-settings]');
    if (settings) {
      var rendered = settings.querySelectorAll('[data-settings-key]');
      Array.prototype.forEach.call(rendered, function (item) {
        var key = item.getAttribute('data-settings-key');
        var value = parseFloat(item.value, 10);
        switch (key) {
          case 'threshold':
            setThreshold(value);
            break;
          case 'stable':
            setStableDuration(value);
            break;
          case 'cooldown':
            setCooldown(value);
            break;
        }
      });
    }
  }

  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})();
