/* Viva La Vida — MediaPipe Hands landmark detection and overlay drawing */
(function () {
  'use strict';

  var state = {
    modelLoaded: false,
    hands: null,
    timestamp: 0,
  };

  var els = {};

  function $(selector) {
    return document.querySelector(selector);
  }

  function showNoHandMessage() {
    if (els.hint) {
      els.hint.classList.remove('detection-overlay__hidden');
    }
  }

  function hideNoHandMessage() {
    if (els.hint) {
      els.hint.classList.add('detection-overlay__hidden');
    }
  }

  function drawLandmarks(canvas, results) {
    if (!canvas || !canvas.getContext) {
      return;
    }
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    var connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [5, 9], [9, 10], [10, 11], [11, 12],
      [5, 13], [13, 14], [14, 15], [15, 16],
      [13, 17], [17, 18], [18, 19], [19, 20],
      [0, 17]
    ];

    ctx.beginPath();
    connections.forEach(function (pair) {
      var a = results.multiHandLandmarks[0][pair[0]];
      var b = results.multiHandLandmarks[0][pair[1]];
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

    results.multiHandLandmarks[0].forEach(function (point) {
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

  function showHandFrame(canvas, results) {
    if (!canvas || !canvas.getContext) {
      return;
    }
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    var box = results.multiHandLandmarks[0];
    if (!box || box.length < 21) {
      return;
    }
    var xs = box.map(function (p) { return p.x; });
    var ys = box.map(function (p) { return p.y; });
    var x0 = Math.max(0, Math.min.apply(null, xs)) - 0.02;
    var x1 = Math.min(1, Math.max.apply(null, xs)) + 0.02;
    var y0 = Math.max(0, Math.min.apply(null, ys)) - 0.02;
    var y1 = Math.min(1, Math.max.apply(null, ys)) + 0.02;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.strokeStyle = 'rgba(25, 232, 121, 0.85)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(x0 * w, y0 * h, (x1 - x0) * w, (y1 - y0) * h);
    ctx.restore();
  }

  function markHandVisible() {
    if (els.handCanvas) {
      els.handCanvas.classList.remove('detection-overlay__hidden');
    }
    if (els.frame) {
      els.frame.classList.remove('u-hidden');
    }
    if (els.hint) {
      els.hint.classList.add('detection-overlay__hidden');
    }
  }

  function markHandHidden() {
    if (els.handCanvas) {
      els.handCanvas.classList.add('detection-overlay__hidden');
    }
    if (els.frame) {
      els.frame.classList.add('u-hidden');
    }
    if (els.hint) {
      els.hint.classList.remove('detection-overlay__hidden');
    }
  }

  function resizeCanvas(canvas) {
    if (!canvas) {
      return;
    }
    var parent = canvas.parentElement;
    if (!parent) {
      return;
    }
    var rect = parent.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return;
    }
    var dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    if (canvas.getContext) {
      var ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
    }
  }

  function exportLandmarks() {
    var canvas = els.handCanvas;
    if (!canvas) {
      return null;
    }
    var ctx = canvas.getContext('2d');
    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var data = imageData.data;
    var points = [];
    var w = canvas.width;
    var h = canvas.height;
    var total = 0;
    for (var j = 0; j < data.length; j += 4) {
      var r = data[j];
      var g = data[j + 1];
      var b = data[j + 2];
      if (r > 90 && g > 200 && b > 90) {
        var col = j / 4;
        points.push({
          x: (col % w) / w,
          y: Math.floor(col / w) / h,
          z: 0.0
        });
        total++;
        if (total >= 21) break;
      }
    }
    if (points.length >= 21) {
      return points.slice(0, 21);
    }
    return null;
  }

  function init() {
    els = {
      handCanvas: document.querySelector('.hand-landmarks'),
      frame: document.querySelector('.hand-frame'),
      hint: document.querySelector('.detection-hint'),
    };

    if (typeof window !== 'undefined' && typeof window.mp !== 'undefined' && window.mp.hands) {
      state.modelLoaded = true;
      state.hands = window.mp.hands;
      state.hands.setOptions({ maxNumHands: 2 });
      if (els.handCanvas) {
        state.modelLoaded = true;
        markHandVisible();
      }
      return;
    }
  }

  // Expose for the recognition pipeline.
  if (typeof window !== 'undefined') {
    window.__vivaLaVidaHandDetection = {
      exportLandmarks: exportLandmarks,
      modelLoaded: function () { return state.modelLoaded; },
    };
  }

  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})();
