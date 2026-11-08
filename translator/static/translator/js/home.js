/* Viva La Vida — homepage state: camera, detection, sentence, visibility toggles */
(function () {
  'use strict';

  var SENTENCE_STORAGE_KEY = 'viva-la-vida:sentence:';
  var RECOGNITION_API_URL = '/api/recognize/';
  var DEFAULT_THRESHOLD = 0.75;
  var DEFAULT_STABLE_DURATION = 600;
  var DEFAULT_COOLDOWN = 1000;
  var CSRF_TOKEN = null;

  var state = {
    stream: null,
    processing: false,
    paused: false,
    handVisible: false,
    lastPrediction: '',
    lastPredictionTime: 0,
    awaitingRecognition: false,
    recognitionTimer: null,
    cooldownTimer: null,
    notificationCount: 0,
    isGuest: false,
    recognitionInFlight: false,
  };

  var state = {
    stream: null,
    processing: false,
    paused: false,
    handVisible: false,
    lastPrediction: '',
    lastPredictionTime: 0,
    awaitingRecognition: false,
    recognitionTimer: null,
    cooldownTimer: null,
    notificationCount: 0,
    isGuest: false,
  };

  var els = {};

  function $(selector) {
    return document.querySelector(selector);
  }

  function $$(selector) {
    return Array.prototype.slice.call(document.querySelectorAll(selector));
  }

  function getSentence() {
    try {
      var stored = localStorage.getItem(SENTENCE_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.error('Failed to read sentence storage', err);
      return [];
    }
  }

  function setSentence(items) {
    try {
      localStorage.setItem(SENTENCE_STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.error('Failed to save sentence storage', err);
    }
  }

  function signEl(sign) {
    return document.createElement('li');
  }

  function appendSign(sign) {
    if (state.isGuest) {
      return;
    }
    var list = els.sentenceList;
    if (!list) {
      return;
    }
    var items = getSentence();
    if (items.indexOf(sign) === -1) {
      items.push(sign);
      setSentence(items);
      renderSentence();
    }
  }

  function renderSentence() {
    var list = els.sentenceList;
    if (!list) {
      return;
    }
    var items = getSentence();
    if (!items.length) {
      list.innerHTML = '';
      return;
    }
    list.innerHTML = items.map(function (sign) {
      return '<li>' + escapeHtml(sign) + '</li>';
    }).join('');
  }

  function escapeHtml(value) {
    var div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
  }

  function showNotificationCount(count) {
    state.notificationCount = count;
  }

  function updateNotificationBadge() {
    var bell = els.notificationBell;
    var badge = els.notificationBadge;
    if (!bell || !badge) {
      return;
    }
    if (state.notificationCount > 0) {
      badge.textContent = state.notificationCount > 99 ? '99+' : state.notificationCount;
      badge.classList.remove('u-hidden');
    } else {
      badge.classList.add('u-hidden');
    }
  }

  function showDetectedSign(label, confidence) {
    var value = els.detectedSignValue;
    if (!value) {
      return;
    }
    if (label === '—' || !label) {
      value.textContent = '—';
      value.classList.add('detection-row__value--initial');
      return;
    }
    value.textContent = label.toUpperCase();
    value.classList.remove('detection-row__value--initial');
    if (typeof confidence !== 'undefined') {
      state.confidence = confidence;
      updateConfidence(confidence);
    }
  }

  function updateConfidence(confidence) {
    var value = els.confidenceValue;
    var fill = els.confidenceFill;
    if (!value || !fill) {
      return;
    }
    if (confidence == null || isNaN(confidence)) {
      value.textContent = '0%';
      fill.style.width = '0%';
      return;
    }
    var percent = Math.round(Math.min(100, Math.max(0, confidence * 100)));
    value.textContent = percent + '%';
    fill.style.width = percent + '%';
    fill.classList.toggle('confidence-fill--low', confidence < 0.4);
  }

  function updateSentenceDisplay() {
    var items = getSentence();
    var hold = els.sentenceHold;
    if (!hold) {
      return;
    }
    if (!items.length) {
      hold.textContent = '…';
      return;
    }
    hold.textContent = items.join(' ');
  }

  function speakSentence() {
    var items = getSentence();
    if (!items.length) {
      if (els.speakStatus) {
        els.speakStatus.textContent = 'Nothing to speak yet.';
      }
      return;
    }
    var text = items.join(' ');
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      var utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.onend = function () {
        state.speaking = false;
        if (els.speakBtn) {
          els.speakBtn.classList.toggle('control-btn--paused', false);
          els.speakBtn.setAttribute('aria-label', 'Speak');
          els.speakBtn.querySelector('span.pulse').classList.add('u-hidden');
        }
      };
      utterance.onerror = function () {
        state.speaking = false;
        if (els.speakBtn) {
          els.speakBtn.classList.toggle('control-btn--paused', false);
          els.speakBtn.setAttribute('aria-label', 'Speak');
          els.speakBtn.querySelector('span.pulse').classList.add('u-hidden');
        }
      };
      state.speaking = true;
      window.speechSynthesis.speak(utterance);
      if (els.speakBtn) {
        els.speakBtn.classList.add('control-btn--paused');
        els.speakBtn.setAttribute('aria-label', 'Speaking');
        var pulse = els.speakBtn.querySelector('span.pulse');
        if (pulse) {
          pulse.classList.remove('u-hidden');
        }
      }
    } else {
      if (els.speakStatus) {
        els.speakStatus.textContent = 'Speech synthesis is not available.';
      }
    }
  }

  function clearSentence() {
    if (state.isGuest) {
      return;
    }
    setSentence([]);
    renderSentence();
    updateSentenceDisplay();
  }

  function bindControls() {
    if (els.speakBtn) {
      els.speakBtn.addEventListener('click', speakSentence);
    }
    if (els.clearBtn) {
      els.clearBtn.addEventListener('click', clearSentence);
    }
    if (els.pauseBtn) {
      els.pauseBtn.addEventListener('click', togglePause);
    }
  }

  function loadCsrfToken() {
    return new Promise(function (resolve) {
      var tokenEl = document.querySelector('meta[name="csrf-token"]');
      if (tokenEl) {
        resolve(tokenEl.getAttribute('content'));
        return;
      }
      var cookieStart = document.cookie.indexOf('csrftoken=');
      if (cookieStart !== -1) {
        var end = document.cookie.indexOf(';', cookieStart);
        if (end === -1) end = document.cookie.length;
        resolve(decodeURIComponent(document.cookie.slice(cookieStart + 10, end)));
      } else {
        resolve(null);
      }
    });
  }

  function sendLandmarks(landmarks) {
    if (state.recognitionInFlight) {
      return;
    }
    state.recognitionInFlight = true;
    var token = CSRF_TOKEN || null;
    fetch(RECOGNITION_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ landmarks: landmarks }),
      credentials: 'same-origin',
    })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (result) {
        state.recognitionInFlight = false;
        if (!result.ok) {
          console.warn('Recognition API error:', result.data);
          return;
        }
        var label = result.data.label || '—';
        var confidence = result.data.confidence || 0;
        if (label === '—') {
          return;
        }
        if (label !== state.lastPrediction) {
          state.lastPrediction = label;
          showDetectedSign(label, confidence);
          updateConfidence(confidence);
          if (window.__vivaLaVidaSpeech && !state.isGuest) {
            window.__vivaLaVidaSpeech.speak(label);
          }
          if (window.__vivaLaVidaRecognition) {
            window.__vivaLaVidaRecognition.onRecognized(label, confidence);
          }
        }
      })
      .catch(function (err) {
        state.recognitionInFlight = false;
        console.error('Recognition fetch failed', err);
      });
  }

  function bindToggle(el, onChange) {
    if (!el) {
      return;
    }
    el.addEventListener('change', function () {
      onChange(el.checked);
    });
  }

  function togglePause() {
    if (state.paused) {
      resumeCamera();
    } else {
      pauseCamera();
    }
  }

  function pauseCamera() {
    state.paused = true;
    if (els.pauseBtn) {
      els.pauseBtn.classList.add('control-btn--paused');
      els.pauseBtn.setAttribute('aria-label', 'Resume camera');
      els.pauseBtn.querySelector('span.label').textContent = 'Resume Camera';
    }
    stopHandProcessing();
    if (els.cameraStatus) {
      els.cameraStatus.classList.add('camera-status--paused');
      els.cameraStatus.setAttribute('data-state', 'paused');
    }
    if (els.detectionHint) {
      els.detectionHint.classList.remove('detection-overlay__hidden');
    }
  }

  function resumeCamera() {
    state.paused = false;
    if (els.pauseBtn) {
      els.pauseBtn.classList.remove('control-btn--paused');
      els.pauseBtn.setAttribute('aria-label', 'Pause camera');
      var label = els.pauseBtn.querySelector('span.label');
      if (label) {
        label.textContent = 'Pause Camera';
      }
    }
    if (els.cameraStatus) {
      els.cameraStatus.classList.remove('camera-status--paused');
      els.cameraStatus.setAttribute('data-state', 'active');
    }
    startHandProcessing();
  }

  function startCamera() {
    if (state.stream && !state.paused) {
      return;
    }
    if (state.stream && state.paused) {
      resumeCamera();
      return;
    }
    startCameraStream();
  }

  function stopCamera() {
    if (state.stream) {
      stopCameraStream();
    }
  }

  function initCameraUI() {
    els.enableCameraBtn.addEventListener('click', startCamera);
  }

  function startCameraStream() {
    if (state.stream) {
      return;
    }
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      startCameraLoop();
    } else {
      showDeviceUnavailable();
    }
  }

  function showPermissionsRequired() {
    hideDetectionOverlay();
    stopHandProcessing();
    if (els.cameraStatus) {
      els.cameraStatus.classList.remove('camera-status--active', 'camera-status--paused');
      els.cameraStatus.setAttribute('data-state', 'inactive');
    }
    if (els.cameraWrap) {
      els.cameraWrap.classList.add('camera-wrap--inactive');
    }
    if (els.handsDemo) {
      els.handsDemo.classList.add('detection-overlay__hidden');
    }
    if (els.detectionHint) {
      els.detectionHint.classList.remove('detection-overlay__hidden');
    }
  }

  function showCameraDenied() {
    showPermissionsRequired();
    if (els.cameraStatus) {
      els.cameraStatus.classList.add('camera-status--paused');
      els.cameraStatus.setAttribute('data-state', 'paused');
    }
    if (els.cameraWrap) {
      els.cameraWrap.classList.add('camera-wrap--inactive');
    }
    if (els.handsDemo) {
      els.handsDemo.classList.add('detection-overlay__hidden');
    }
    if (els.detectionHint) {
      els.detectionHint.classList.remove('detection-overlay__hidden');
    }
    if (els.permissionDenied) {
      els.permissionDenied.classList.remove('u-hidden');
    }
  }

  function showDeviceUnavailable() {
    showPermissionsRequired();
    if (els.cameraStatus) {
      els.cameraStatus.classList.add('camera-status--paused');
      els.cameraStatus.setAttribute('data-state', 'paused');
    }
    if (els.cameraWrap) {
      els.cameraWrap.classList.add('camera-wrap--inactive');
    }
    if (els.handsDemo) {
      els.handsDemo.classList.add('detection-overlay__hidden');
    }
    if (els.detectionHint) {
      els.detectionHint.classList.remove('detection-overlay__hidden');
    }
    if (els.permissionDenied) {
      els.permissionDenied.classList.remove('u-hidden');
    }
  }

  function hideDetectionOverlay() {
    if (els.handFrame) {
      els.handFrame.classList.add('u-hidden');
    }
    if (els.landmarksPath) {
      els.landmarksPath.classList.add('u-hidden');
    }
    if (els.handCanvas) {
      els.handCanvas.classList.add('detection-overlay__hidden');
    }
    if (els.detectionHint) {
      els.detectionHint.classList.add('detection-overlay__hidden');
    }
  }

  function startCameraLoop() {
    var video = els.cameraVideo;
    if (!video) {
      return;
    }
    if (state.loopTimer) {
      clearInterval(state.loopTimer);
    }
    state.processing = true;
    state.paused = false;
    state.handVisible = false;
    showDetectionOverlay();
    hideDeviceUnavailable();
    if (els.cameraStatus) {
      els.cameraStatus.classList.add('camera-status--active');
      els.cameraStatus.setAttribute('data-state', 'active');
    }
    state.loopTimer = setInterval(function () {
      if (state.paused || !state.processing || !state.stream) {
        return;
      }
      if (els.handCanvas && els.handCanvas.getContext) {
        updateHandOverlay();
      }
    }, 60);
    if (els.handLandmarks) {
      startLandmarkLoop();
    }
  }

  function stopCameraStream() {
    if (state.loopTimer) {
      clearInterval(state.loopTimer);
      state.loopTimer = null;
    }
    state.processing = false;
    if (els.handCanvas && state.handCanvasLoop) {
      clearInterval(state.handCanvasLoop);
      state.handCanvasLoop = null;
    }
    if (els.handLandmarks) {
      stopLandmarkLoop();
    }
    if (state.stream && state.stream.getVideoTracks) {
      state.stream.getVideoTracks().forEach(function (track) {
        track.stop();
      });
    }
    state.stream = null;
  }

  function showHandDetected(landmarks) {
    state.handVisible = true;
    state.lastPredictionTime = state.respectNow ? performance.now() : Date.now();
    if (els.handCanvas) {
      drawLandmarks(landmarks);
    }
    if (els.handFrame) {
      showHandFrame(landmarks);
    }
    if (els.detectionHint) {
      els.detectionHint.classList.add('detection-overlay__hidden');
    }
    if (els.cameraStatus) {
      els.cameraStatus.classList.add('camera-status--active');
      els.cameraStatus.setAttribute('data-state', 'active');
    }
  }

  function hideHandDetected() {
    state.handVisible = false;
    hideHandFrame();
    hideLandmarks();
    if (els.detectionHint) {
      els.detectionHint.classList.remove('detection-overlay__hidden');
    }
    if (els.cameraStatus) {
      els.cameraStatus.classList.remove('camera-status--active');
      els.cameraStatus.setAttribute('data-state', 'inactive');
    }
  }

  function init() {
    state.isGuest = Boolean(document.body.classList.contains('guest'));
    state.sentence = getSentence();
    if (!state.sentence.length) {
      state.sentence = [];
    }
    els = {
      cameraVideo: document.querySelector('video.camera-preview'),
      cameraWrap: document.querySelector('.camera-wrap'),
      cameraStatus: document.querySelector('.camera-status'),
      handsDemo: document.querySelector('[data-handlandmarks]'),
      landmarkCanvas: document.querySelector('[data-handlandmarks] canvas'),
      handCanvas: document.querySelector('.hand-landmarks'),
      handFrame: document.querySelector('.hand-frame'),
      detectionHint: document.querySelector('.detection-hint'),
      permissionDenied: document.querySelector('.permission-denied'),
      enableCameraBtn: document.querySelector('.camera-hold button'),
      sentenceList: document.querySelector('.sentence-list'),
      sentenceHold: document.querySelector('.sentence-hold'),
      speakBtn: document.querySelector('[data-action="speak"]'),
      speakStatus: document.querySelector('[data-speak-status]'),
      clearBtn: document.querySelector('[data-action="clear"]'),
      pauseBtn: document.querySelector('[data-action="pause"]'),
      notificationBell: document.querySelector('[data-notification="bell"]'),
      notificationBadge: document.querySelector('[data-notification="badge"]'),
      settings: document.querySelector('[data-settings]'),
      confidenceFill: document.querySelector('.confidence-fill'),
      confidenceValue: document.querySelector('.confidence-value'),
      detectedSignValue: document.querySelector('[data-detected="label"]'),
    };

    renderSentence();
    updateSentenceDisplay();
    updateNotificationBadge();

    if (els.detectedSignValue) {
      els.detectedSignValue.textContent = '—';
    }
    if (els.confidenceValue) {
      els.confidenceValue.textContent = '0%';
    }
    if (els.confidenceFill) {
      els.confidenceFill.style.width = '0%';
      els.confidenceFill.classList.add('confidence-fill--low');
    }

    bindControls();
    bindToggle(els.landmarksSwitch, function (checked) {
      if (checked) {
        showLandmarks();
      } else {
        hideLandmarks();
      }
    });
    bindToggle(els.visualizationSwitch, function (checked) {
      if (checked) {
        showDetectionOverlay();
      } else {
        hideDetectionOverlay();
      }
    });

    initCameraUI();
    loadCsrfToken().then(function (token) {
      CSRF_TOKEN = token;
    });

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('pagehide', stopCamera);
      window.addEventListener('visibilitychange', function () {
        if (document.hidden) {
          if (state.stream && !state.paused) {
            stopHandProcessing();
            if (els.cameraStatus) {
              els.cameraStatus.classList.add('camera-status--paused');
              els.cameraStatus.setAttribute('data-state', 'paused');
            }
          }
        } else {
          if (state.stream && state.paused) {
            resumeCamera();
          } else {
            startCamera();
          }
        }
      });
    }

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('pagehide', stopCamera);
      window.addEventListener('visibilitychange', function () {
        if (document.hidden) {
          if (state.stream && !state.paused) {
            stopHandProcessing();
            if (els.cameraStatus) {
              els.cameraStatus.classList.add('camera-status--paused');
              els.cameraStatus.setAttribute('data-state', 'paused');
            }
          }
        } else {
          if (state.stream && state.paused) {
            resumeCamera();
          } else {
            startCamera();
          }
        }
      });
    }
  }

  function bindToggle(el, onChange) {
    if (!el) {
      return;
    }
    el.addEventListener('change', function () {
      onChange(el.checked);
    });
  }

  function startLandmarkLoop() {
    if (state.handCanvasLoop) {
      clearInterval(state.handCanvasLoop);
    }
    state.handCanvasLoop = setInterval(function () {
      if (state.paused || !state.processing || !els.handCanvas) {
        return;
      }
      drawLandmarks(els.landmarksData);
      // Request recognition every 3rd frame.
      if ((state.recognitionFrameCounter || 0) % 3 === 0) {
        state.recognitionFrameCounter = 0;
        sendRecognition();
      } else {
        state.recognitionFrameCounter++;
      }
    }, 30);
  }

  function stopLandmarkLoop() {
    if (state.handCanvasLoop) {
      clearInterval(state.handCanvasLoop);
      state.handCanvasLoop = null;
    }
    state.recognitionFrameCounter = 0;
  }

  function startCameraLoopOnce() {
    if (state.cameraTimer) {
      clearTimeout(state.cameraTimer);
    }
    state.cameraTimer = setTimeout(function () {
      if (state.processing && !state.paused) {
        if (els.handCanvas) {
          updateLandmarkCanvas();
        }
      }
    }, 80);
  }

  function updateHandOverlay() {
    if (!els.handCanvas || !els.landmarksData) {
      return;
    }
    var ctx = els.handCanvas.getContext('2d');
    ctx.clearRect(0, 0, els.handCanvas.width, els.handCanvas.height);
    drawLandmarks(els.landmarksData);
    if (els.handFrame) {
      showHandFrame(els.landmarksData);
    }
  }

  function drawLandmarks(landmarks) {
    if (!landmarks || !landmarks.landmark || !els.handCanvas) {
      return;
    }
    var canvas = els.handCanvas;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    var w = canvas.width;
    var h = canvas.height;

    var connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [5, 9], [9, 10], [10, 11], [11, 12],
      [9, 13], [13, 14], [14, 15], [15, 16],
      [13, 17], [17, 18], [18, 19], [19, 20],
      [0, 17]
    ];

    ctx.beginPath();
    connections.forEach(function (pair) {
      var a = landmarks.landmark[pair[0]];
      var b = landmarks.landmark[pair[1]];
      if (!a || !b) {
        return;
      }
      var ax = a.x * w;
      var ay = a.y * h;
      var bx = b.x * w;
      var by = b.y * h;
      if (pair[0] === 0) {
        ctx.moveTo(ax, ay);
      } else {
        ctx.lineTo(ax, ay);
      }
    });
    ctx.strokeStyle = 'rgba(25, 232, 121, 0.65)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    landmarks.landmark.forEach(function (point, index) {
      if (!point) {
        return;
      }
      var x = point.x * w;
      var y = point.y * h;
      ctx.beginPath();
      ctx.arc(x, y, 3.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(25, 232, 121, 0.85)';
      ctx.fill();
      ctx.strokeStyle = '#020f0a';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    });
  }

  function showHandFrame(landmarks) {
    if (!landmarks || !landmarks.landmark || !els.handFrame) {
      return;
    }
    var ll = landmarks.landmark;
    var xs = ll.map(function (p) { return p.x; });
    var ys = ll.map(function (p) { return p.y; });
    var x0 = Math.max(0, Math.min.apply(null, xs)) - 0.02;
    var x1 = Math.min(1, Math.max.apply(null, xs)) + 0.02;
    var y0 = Math.max(0, Math.min.apply(null, ys)) - 0.02;
    var y1 = Math.min(1, Math.max.apply(null, ys)) + 0.02;
    els.handFrame.style.left = (x0 * 100) + '%';
    els.handFrame.style.top = (y0 * 100) + '%';
    els.handFrame.style.width = ((x1 - x0) * 100) + '%';
    els.handFrame.style.height = ((y1 - y0) * 100) + '%';
  }

  function hideHandFrame() {
    if (els.handFrame) {
      els.handFrame.classList.add('u-hidden');
    }
  }

  function hideLandmarks() {
    if (els.handCanvas) {
      els.handCanvas.classList.add('detection-overlay__hidden');
    }
    if (els.landmarksPath) {
      els.landmarksPath.classList.add('u-hidden');
    }
    if (els.handFrame) {
      els.handFrame.classList.add('u-hidden');
    }
  }

  function showLandmarks() {
    if (els.handCanvas) {
      els.handCanvas.classList.remove('detection-overlay__hidden');
    }
    if (els.landmarksPath) {
      els.landmarksPath.classList.remove('u-hidden');
    }
    if (els.handFrame) {
      els.handFrame.classList.remove('u-hidden');
    }
  }

  function captureLandmarksForRecognition() {
    if (!els.handCanvas) {
      return null;
    }
    var ctx = els.handCanvas.getContext('2d');
    var w = els.handCanvas.width;
    var h = els.handCanvas.height;
    var imageData = ctx.getImageData(0, 0, w, h);
    var data = imageData.data;
    var points = [];
    var total = 0;
    for (var i = 0; i < data.length; i += 4) {
      var r = data[i];
      var g = data[i + 1];
      var b = data[i + 2];
      if (r > 120 && g > 200 && b > 120) {
        var x = (i % 4 === 0) ? i / 4 : points.length;
        // Map RGB to normalized coordinates (placeholder for landmark JSON)
        points.push({
          x: Math.random(),
          y: Math.random(),
          z: 0.0
        });
      }
    }
    if (points.length >= 21) {
      return points.slice(0, 21);
    }
    return null;
  }

  function sendRecognition() {
    var landmarks = captureLandmarksForRecognition();
    if (!landmarks) {
      return;
    }
    sendLandmarks(landmarks);
  }

  function showDetectionOverlay() {
    if (els.handCanvas) {
      els.handCanvas.classList.remove('detection-overlay__hidden');
    }
    if (els.handFrame) {
      els.handFrame.classList.remove('u-hidden');
    }
  }

  function showNoHandMessage() {
    if (els.detectionHint) {
      els.detectionHint.classList.remove('detection-overlay__hidden');
    }
    if (els.cameraStatus) {
      els.cameraStatus.classList.remove('camera-status--active');
      els.cameraStatus.setAttribute('data-state', 'inactive');
    }
  }

  function updateHandVisibility(handVisible) {
    if (handVisible) {
      showHandDetected(els.landmarksData);
    } else {
      hideHandDetected();
    }
  }

  function updateDetection(label, confidence) {
    if (typeof label !== 'undefined') {
      if (label && confidence >= DEFAULT_THRESHOLD) {
        showDetectedSign(label, confidence);
        state.lastPrediction = label;
        state.lastPredictionTime = state.respectNow ? performance.now() : Date.now();
        if (!state.awaitingRecognition) {
          state.awaitingRecognition = true;
          if (state.recognitionTimer) {
            clearTimeout(state.recognitionTimer);
          }
          state.recognitionTimer = setTimeout(function () {
            if (state.awaitingRecognition) {
              appendSign(label);
              state.awaitingRecognition = false;
            }
          }, 300);
        }
      } else {
        hideDetectedSign();
      }
    }
  }

  function hideDetectedSign() {
    var value = els.detectedSignValue;
    if (value) {
      value.textContent = '—';
      value.classList.add('detection-row__value--initial');
    }
    if (els.confidenceValue) {
      els.confidenceValue.textContent = '0%';
      if (els.confidenceFill) {
        els.confidenceFill.style.width = '0%';
        els.confidenceFill.classList.add('confidence-fill--low');
      }
    }
    state.lastPrediction = '';
    state.lastPredictionTime = 0;
    state.awaitingRecognition = false;
    if (state.recognitionTimer) {
      clearTimeout(state.recognitionTimer);
      state.recognitionTimer = null;
    }
  }

  function preventDuplicateDetection(label) {
    var now = state.respectNow ? performance.now() : Date.now();
    if (state.lastPrediction === label &&
        state.lastPredictionTime > 0 &&
        now - state.lastPredictionTime < DEFAULT_COOLDOWN) {
      return false;
    }
    return true;
  }

  function initNotification() {
    if (els.notificationBell) {
      els.notificationBell.addEventListener('click', function () {
        state.notificationCount += 1;
        updateNotificationBadge();
        showNotification();
      });
    }
  }

  function showNotification() {
    if (!els.notificationBadge) {
      return;
    }
    els.notificationBadge.textContent = Math.min(99, state.notificationCount);
    els.notificationBadge.classList.remove('u-hidden');
  }

  function initHandlandmarks() {
    if (!els.handCanvas) {
      return;
    }
    updateHandVisibility(true);
    if (typeof canvasUtilities !== 'undefined') {
      canvasUtilities.init(els.handCanvas);
    }
  }

  function overrideCanvasSize(canvas) {
    if (!canvas) {
      return;
    }
    var container = canvas.parentElement;
    if (!container) {
      return;
    }
    var rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return;
    }
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    if (typeof canvasUtilities !== 'undefined') {
      canvasUtilities.resize(canvas);
    }
  }

  function onLandmarksReceived(landmarks) {
    state.landmarksData = landmarks;
    if (els.handCanvas && state.landmarksData && state.processing && !state.paused) {
      drawLandmarks(state.landmarksData);
      if (els.handFrame) {
        showHandFrame(state.landmarksData);
      }
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
