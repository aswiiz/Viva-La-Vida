/* Viva La Vida — camera permission, stream lifecycle and pause/resume */
(function () {
  'use strict';

  var state = {
    stream: null,
    requested: false,
    paused: false,
    processing: false,
    timer: null,
  };

  var els = {};

  function $(selector) {
    return document.querySelector(selector);
  }

  function showPermissionRequired() {
    var wrap = els.cameraWrap;
    var status = els.cameraStatus;
    var hint = els.detectionHint;
    if (wrap) {
      wrap.classList.add('camera-wrap--inactive');
    }
    if (status) {
      status.classList.remove('camera-status--active', 'camera-status--paused');
      status.setAttribute('data-state', 'inactive');
    }
    if (hint) {
      hint.classList.remove('detection-overlay__hidden');
    }
    if (els.handCanvas) {
      els.handCanvas.classList.add('detection-overlay__hidden');
    }
    if (els.handFrame) {
      els.handFrame.classList.add('u-hidden');
    }
    if (els.permissionDenied) {
      els.permissionDenied.classList.add('u-hidden');
    }
    if (els.permissionStart) {
      els.permissionStart.classList.remove('u-hidden');
    }
  }

  function showCameraDenied() {
    var wrap = els.cameraWrap;
    var status = els.cameraStatus;
    if (wrap) {
      wrap.classList.add('camera-wrap--inactive');
    }
    if (status) {
      status.classList.add('camera-status--paused');
      status.setAttribute('data-state', 'paused');
    }
    if (els.permissionDenied) {
      els.permissionDenied.classList.remove('u-hidden');
    }
    if (els.handCanvas) {
      els.handCanvas.classList.add('detection-overlay__hidden');
    }
    if (els.handFrame) {
      els.handFrame.classList.add('u-hidden');
    }
  }

  function showCameraUnavailable() {
    var wrap = els.cameraWrap;
    var status = els.cameraStatus;
    if (wrap) {
      wrap.classList.add('camera-wrap--inactive');
    }
    if (status) {
      status.classList.add('camera-status--paused');
      status.setAttribute('data-state', 'paused');
    }
    if (els.permissionDenied) {
      els.permissionDenied.classList.remove('u-hidden');
    }
    if (els.handCanvas) {
      els.handCanvas.classList.add('detection-overlay__hidden');
    }
    if (els.handFrame) {
      els.handFrame.classList.add('u-hidden');
    }
  }

  function hideCameraDenied() {
    if (els.permissionDenied) {
      els.permissionDenied.classList.add('u-hidden');
    }
  }

  function showDetectionOverlay() {
    if (els.handCanvas) {
      els.handCanvas.classList.remove('detection-overlay__hidden');
    }
    if (els.handFrame) {
      els.handFrame.classList.remove('u-hidden');
    }
    if (els.detectionHint) {
      els.detectionHint.classList.add('detection-overlay__hidden');
    }
  }

  function startCameraStream() {
    if (state.stream) {
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showCameraUnavailable();
      return;
    }
    state.requested = true;
    state.processing = true;
    state.paused = false;
    showDetectionOverlay();
    hideCameraDenied();
    if (els.cameraStatus) {
      els.cameraStatus.classList.add('camera-status--active');
      els.cameraStatus.setAttribute('data-state', 'active');
    }
    if (els.cameraWrap) {
      els.cameraWrap.classList.remove('camera-wrap--inactive');
    }
    state.requested = true;
    try {
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(function (stream) {
          if (state.stream) {
            stopCameraStream();
          }
          state.stream = stream;
          var video = els.cameraVideo;
          if (video) {
            video.srcObject = stream;
            video.play().catch(function (err) {
              console.error('Camera play failed', err);
            });
          }
          if (els.cameraStatus) {
            els.cameraStatus.classList.add('camera-status--active');
            els.cameraStatus.setAttribute('data-state', 'active');
          }
          state.processing = true;
          if (els.detectionHint) {
            els.detectionHint.classList.add('detection-overlay__hidden');
          }
        })
        .catch(function (err) {
          var code = (err && err.name) || 'NotAllowedError';
          console.error('Camera permission denied', err);
          state.processing = false;
          if (code === 'NotAllowedError') {
            showCameraDenied();
          } else {
            showCameraUnavailable();
            if (els.cameraStatus) {
              els.cameraStatus.classList.add('camera-status--paused');
              els.cameraStatus.setAttribute('data-state', 'paused');
            }
          }
        });
    } catch (err) {
      console.error('Camera start failed', err);
      state.processing = false;
      showCameraUnavailable();
    }
  }

  function stopCameraStream() {
    state.processing = false;
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    if (state.stream && state.stream.getVideoTracks) {
      state.stream.getVideoTracks().forEach(function (track) {
        track.stop();
      });
    }
    state.stream = null;
    if (els.handCanvas) {
      els.handCanvas.classList.add('detection-overlay__hidden');
    }
    if (els.handFrame) {
      els.handFrame.classList.add('u-hidden');
    }
    if (els.detectionHint) {
      els.detectionHint.classList.add('detection-overlay__hidden');
    }
    if (els.cameraStatus) {
      els.cameraStatus.classList.remove('camera-status--active', 'camera-status--paused');
      els.cameraStatus.setAttribute('data-state', 'inactive');
    }
    if (els.cameraWrap) {
      els.cameraWrap.classList.add('camera-wrap--inactive');
    }
    state.stream = null;
  }

  function pauseCamera() {
    state.paused = true;
    if (els.pauseBtn) {
      els.pauseBtn.classList.add('control-btn--paused');
      els.pauseBtn.setAttribute('aria-label', 'Resume camera');
      var label = els.pauseBtn.querySelector('span.label');
      if (label) {
        label.textContent = 'Resume Camera';
      }
    }
    if (els.cameraStatus) {
      els.cameraStatus.classList.add('camera-status--paused');
      els.cameraStatus.setAttribute('data-state', 'paused');
    }
    if (els.detectionHint) {
      els.detectionHint.classList.remove('detection-overlay__hidden');
    }
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    state.processing = false;
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
    if (els.detectionHint) {
      els.detectionHint.classList.add('detection-overlay__hidden');
    }
    if (!state.stream) {
      startCameraStream();
    } else {
      state.processing = true;
    }
  }

  function stopCamera() {
    stopCameraStream();
  }

  function init() {
    els = {
      cameraVideo: document.querySelector('video.camera-preview'),
      cameraWrap: document.querySelector('.camera-wrap'),
      cameraStatus: document.querySelector('.camera-status'),
      detectionHint: document.querySelector('.detection-hint'),
      permissionDenied: document.querySelector('.permission-denied'),
      permissionStart: document.querySelector('.camera-hold button'),
      handCanvas: document.querySelector('.hand-landmarks'),
      handFrame: document.querySelector('.hand-frame'),
      pauseBtn: document.querySelector('[data-action="pause"]'),
    };

    if (els.permissionStart) {
      els.permissionStart.addEventListener('click', startCameraStream);
    }
    if (els.pauseBtn) {
      els.pauseBtn.addEventListener('click', function () {
        if (state.paused) {
          resumeCamera();
        } else {
          pauseCamera();
        }
      });
    }

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('pagehide', stopCamera);
      window.addEventListener('visibilitychange', function () {
        if (document.hidden && state.stream && !state.paused) {
          pauseCamera();
        } else if (!document.hidden && state.stream && state.paused) {
          resumeCamera();
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
