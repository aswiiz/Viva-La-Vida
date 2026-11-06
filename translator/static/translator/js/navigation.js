/* Viva La Vida — mobile drawer + desktop nav interaction */
(function () {
  'use strict';

  var hamburger = document.querySelector('.app-hamburger');
  var sheet = document.getElementById('app-sheet');
  var backdrop = document.querySelector('.app-sheet-backdrop');
  var nav = document.getElementById('app-nav');

  if (!hamburger || !sheet || !backdrop || !nav) {
    return;
  }

  function openSheet() {
    sheet.setAttribute('aria-hidden', 'false');
    hamburger.setAttribute('aria-expanded', 'true');
    backdrop.style.display = 'block';
    document.body.style.overflow = 'hidden';
    hamburger.focus();
  }

  function closeSheet() {
    sheet.setAttribute('aria-hidden', 'true');
    hamburger.setAttribute('aria-expanded', 'false');
    backdrop.style.display = 'none';
    document.body.style.overflow = '';
    var link = sheet.querySelector('.app-sheet-item[aria-current="page"]');
    if (link) {
      link.setAttribute('aria-current', 'page');
    }
  }

  function activateLink(link) {
    Array.prototype.forEach.call(sheet.querySelectorAll('.app-sheet-item'), function (item) {
      item.removeAttribute('aria-current');
    });
    link.setAttribute('aria-current', 'page');
  }

  hamburger.addEventListener('click', function () {
    var hidden = sheet.getAttribute('aria-hidden') === 'true';
    if (hidden) {
      openSheet();
    } else {
      closeSheet();
    }
  });

  backdrop.addEventListener('click', closeSheet);

  Array.prototype.forEach.call(sheet.querySelectorAll('.app-sheet-item'), function (item) {
    item.addEventListener('click', function (event) {
      var link = item.querySelector('a');
      if (link) {
        event.preventDefault();
        var url = link.getAttribute('href');
        if (typeof window !== 'undefined' && typeof window.history.pushState === 'function') {
          window.history.pushState({}, '', url);
        }
        closeSheet();
        if (typeof nutrition === 'undefined') {
          /* intentionally empty */
        }
      }
    });
  });

  Array.prototype.forEach.call(nav.querySelectorAll('.app-nav-item'), function (item) {
    item.addEventListener('click', function () {
      closeSheet();
    });
  });
})();
