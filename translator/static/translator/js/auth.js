/* Viva La Vida — auth page interactions (validation, toggles, loading state) */
(function () {
  'use strict';

  var MIN_PASSWORD_LENGTH = 6;

  function errorElement(field) {
    return document.querySelector('[data-error-for="' + field.name + '"]');
  }

  function showError(field, message) {
    var target = errorElement(field);
    field.classList.add('is-invalid');
    field.setAttribute('aria-invalid', 'true');
    if (target) {
      target.textContent = message;
    }
  }

  function clearError(field) {
    var target = errorElement(field);
    field.classList.remove('is-invalid');
    field.removeAttribute('aria-invalid');
    if (target) {
      target.textContent = '';
    }
  }

  function validateField(field, mode) {
    var value = field.value;
    var trimmed = value.trim();

    if (field.name === 'username') {
      if (!trimmed) {
        showError(field, 'Please enter a username.');
        return false;
      }
    }

    if (field.name === 'password') {
      if (!value) {
        showError(field, 'Please enter your password.');
        return false;
      }
      if (mode === 'signup' && value.length < MIN_PASSWORD_LENGTH) {
        showError(field, 'Password must be at least ' + MIN_PASSWORD_LENGTH + ' characters.');
        return false;
      }
    }

    if (field.name === 'confirm_password') {
      var password = field.form.querySelector('#password');
      if (!value) {
        showError(field, 'Please confirm your password.');
        return false;
      }
      if (password && value !== password.value) {
        showError(field, 'Passwords do not match.');
        return false;
      }
    }

    clearError(field);
    return true;
  }

  function setLoading(form) {
    var button = form.querySelector('button[type="submit"].btn-primary') ||
      form.querySelector('button[type="submit"]');
    if (!button) {
      return;
    }

    var label = button.querySelector('.btn-label');
    var loadingLabel = button.getAttribute('data-loading-label');

    button.classList.add('is-loading');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');

    if (label && loadingLabel) {
      label.textContent = loadingLabel;
    }
  }

  function initPasswordToggles() {
    var toggles = document.querySelectorAll('[data-toggle-password]');

    Array.prototype.forEach.call(toggles, function (toggle) {
      toggle.addEventListener('click', function () {
        var input = document.getElementById(toggle.getAttribute('data-toggle-password'));
        if (!input) {
          return;
        }

        var showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';

        toggle.setAttribute('aria-pressed', showing ? 'false' : 'true');
        toggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');

        var eye = toggle.querySelector('.icon-eye');
        var eyeOff = toggle.querySelector('.icon-eye-off');
        if (eye) {
          eye.hidden = !showing;
        }
        if (eyeOff) {
          eyeOff.hidden = showing;
        }

        input.focus({ preventScroll: true });
      });
    });
  }

  function initForm(form) {
    var mode = form.getAttribute('data-mode') || 'signin';
    var fields = form.querySelectorAll('input[name="username"], input[name="password"], input[name="confirm_password"]');

    Array.prototype.forEach.call(fields, function (field) {
      field.addEventListener('input', function () {
        if (field.classList.contains('is-invalid')) {
          clearError(field);
        }
      });
      field.addEventListener('blur', function () {
        if (field.value) {
          validateField(field, mode);
        }
      });
    });

    form.addEventListener('submit', function (event) {
      var valid = true;
      var firstInvalid = null;

      Array.prototype.forEach.call(fields, function (field) {
        if (!validateField(field, mode)) {
          valid = false;
          if (!firstInvalid) {
            firstInvalid = field;
          }
        }
      });

      if (!valid) {
        event.preventDefault();
        if (firstInvalid) {
          firstInvalid.focus();
        }
        return;
      }

      setLoading(form);
    });
  }

  function init() {
    initPasswordToggles();
    Array.prototype.forEach.call(document.querySelectorAll('[data-auth-form]'), initForm);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
