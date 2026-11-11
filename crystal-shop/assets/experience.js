/*
 * Experience switching.
 * The choice ("metaphysical" or "mineral") lives in localStorage and on
 * <html data-experience>. Any element with [data-set-experience] sets it;
 * links keep navigating as normal. A ?experience= URL parameter also sets it
 * (handled inline in layout/theme.liquid so there is no flash).
 */
(function () {
  var KEY = 'crystal_experience';
  var root = document.documentElement;

  function current() {
    return root.getAttribute('data-experience');
  }

  function sync() {
    var value = current();
    document.querySelectorAll('button[data-set-experience]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.setExperience === value));
    });
    document.querySelectorAll('[data-experience-input]').forEach(function (input) {
      input.value = value;
    });
  }

  function set(value) {
    if (value !== 'metaphysical' && value !== 'mineral') return;
    root.setAttribute('data-experience', value);
    try {
      localStorage.setItem(KEY, value);
    } catch (e) {}
    sync();
    document.dispatchEvent(new CustomEvent('experience:change', { detail: { experience: value } }));
  }

  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-set-experience]');
    if (trigger) set(trigger.dataset.setExperience);
  });

  // Pages restored from the back/forward cache need their controls re-synced.
  window.addEventListener('pageshow', function () {
    try {
      var saved = localStorage.getItem(KEY);
      if (saved && saved !== current()) root.setAttribute('data-experience', saved);
    } catch (e) {}
    sync();
  });

  sync();
})();
