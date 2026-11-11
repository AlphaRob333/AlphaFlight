/*
 * Mining game (sections/mine.liquid).
 * Each dig site carries a JSON list of real, in-stock products. A dig hides a
 * few of them behind rocks; breaking a rock reveals the product with its price
 * and an add-to-cart button. Finds are kept in a field log in localStorage.
 * Nothing is bought or reserved by playing.
 */
(function () {
  var root = document.querySelector('[data-mine]');
  if (!root) return;

  var LOG_KEY = 'crystal_field_log';
  var ROCKS = 12;
  var strings = JSON.parse(root.querySelector('[data-mine-strings]').textContent);
  var perDig = parseInt(root.dataset.perDig, 10) || 4;
  var cartAddUrl = root.dataset.cartAddUrl;
  var cartUrl = root.dataset.cartUrl;
  var mapView = root.querySelector('[data-mine-map]');
  var live = root.querySelector('[data-mine-live]');
  var log = readLog();
  var sites = {};
  var engine = window.CrystalMine3D;
  var use3d = !!(engine && engine.supported());

  root.querySelectorAll('[data-mine-site]').forEach(function (el) {
    var specimens = [];
    try {
      specimens = JSON.parse(el.querySelector('[data-specimens]').textContent);
    } catch (e) {}
    sites[el.dataset.mineSite] = {
      id: el.dataset.mineSite,
      el: el,
      specimens: specimens,
      face: el.querySelector('[data-face]'),
      status: el.querySelector('[data-status]'),
      finds: el.querySelector('[data-finds]'),
      findsWrap: el.querySelector('[data-finds-wrap]'),
      newDig: el.querySelector('[data-new-dig]'),
      rock: el.dataset.rock,
      color: el.dataset.color,
      stage: null,
      built: false,
      hidden: 0,
      found: 0,
    };
  });

  /* Helpers ---------------------------------------------------------------- */

  function text(template, values) {
    return template.replace(/\[(\w+)\]/g, function (match, key) {
      return key in values ? values[key] : match;
    });
  }

  function el(tag, className, content) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (content != null) node.textContent = content;
    return node;
  }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function announce(message) {
    live.textContent = '';
    setTimeout(function () {
      live.textContent = message;
    }, 50);
  }

  function readLog() {
    try {
      return JSON.parse(localStorage.getItem(LOG_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function saveLog() {
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(log));
    } catch (e) {}
  }

  // Logged finds that are still in stock at this site.
  function loggedSpecimens(site) {
    var ids = log[site.id] || [];
    return site.specimens.filter(function (s) {
      return ids.indexOf(s.id) !== -1;
    });
  }

  function updateCounts() {
    var total = 0;
    Object.keys(sites).forEach(function (id) {
      var n = loggedSpecimens(sites[id]).length;
      total += n;
      var badge = root.querySelector('[data-site-count="' + id + '"]');
      if (badge) badge.textContent = n ? text(strings.site_count, { n: n }) : '';
    });
    root.querySelector('[data-log-total]').textContent = total
      ? text(strings.log_total, { n: total })
      : strings.log_empty;
    root.querySelector('[data-clear-log]').hidden = !total;
  }

  /* Find cards --------------------------------------------------------------- */

  function addCard(site, specimen, isNew) {
    if (site.finds.querySelector('[data-find="' + specimen.id + '"]')) return;

    var card = el('li', 'mine__find' + (isNew ? ' is-new' : ''));
    card.dataset.find = specimen.id;

    var media = el('div', 'mine__find-media');
    if (specimen.image) {
      var img = el('img');
      img.src = specimen.image;
      img.alt = '';
      img.loading = 'lazy';
      media.appendChild(img);
    }
    card.appendChild(media);

    var body = el('div', 'mine__find-body');
    if (specimen.species) body.appendChild(el('p', 'label', specimen.species));
    body.appendChild(el('h4', 'mine__find-title', specimen.title));

    var data = [specimen.formula, specimen.hardness && strings.hardness + ' ' + specimen.hardness, specimen.locality]
      .filter(Boolean)
      .join(' · ');
    if (data) body.appendChild(el('p', 'mine__find-data', data));

    body.appendChild(el('p', 'mine__find-price', specimen.price));

    var button = el('button', 'button button--full', strings.add);
    button.type = 'button';
    var message = el('p', 'mine__find-message');
    message.setAttribute('role', 'status');
    button.addEventListener('click', function () {
      addToCart(specimen, button, message);
    });
    body.appendChild(button);
    body.appendChild(message);

    if (specimen.url) {
      var details = el('a', 'mine__find-link', strings.details);
      details.href = specimen.url;
      body.appendChild(details);
    }

    card.appendChild(body);
    site.finds.insertBefore(card, isNew ? site.finds.firstChild : null);
    site.findsWrap.hidden = false;
  }

  function addToCart(specimen, button, message) {
    function done() {
      button.textContent = strings.added;
      button.disabled = true;
      message.textContent = '';
      var link = el('a', null, strings.view_cart);
      link.href = cartUrl || '#';
      message.appendChild(link);
    }

    // Without a cart endpoint (static preview) just show the end state.
    if (!cartAddUrl) return done();

    button.disabled = true;
    button.textContent = strings.adding;
    fetch(cartAddUrl + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: [{ id: specimen.variantId, quantity: 1 }] }),
    })
      .then(function (response) {
        return response.json().then(function (json) {
          if (!response.ok) throw new Error(json.description || strings.add_error);
          return json;
        });
      })
      .then(function () {
        done();
        return fetch(cartUrl + '.js', { headers: { Accept: 'application/json' } })
          .then(function (r) {
            return r.json();
          })
          .then(function (cart) {
            document.querySelectorAll('[data-cart-count]').forEach(function (node) {
              node.textContent = '(' + cart.item_count + ')';
            });
          })
          .catch(function () {});
      })
      .catch(function (error) {
        button.disabled = false;
        button.textContent = strings.add;
        message.textContent = error && error.message ? error.message : strings.add_error;
      });
  }

  /* Digging ------------------------------------------------------------------ */

  var CRACKS =
    '<svg class="mine__cracks" viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
    '<path class="mine__crack mine__crack--1" d="M48 0 54 22 40 38 58 55 46 72 52 100"/>' +
    '<path class="mine__crack mine__crack--2" d="M0 44 22 50 40 38M58 55 80 48 100 60M46 72 24 84"/>' +
    '</svg>';

  function setStatus(site) {
    var values = { hidden: site.hidden, found: site.found };
    var template = strings.status_start;
    if (site.found >= site.hidden) template = strings.status_done;
    else if (site.found > 0) template = strings.status_progress;
    site.status.textContent = text(template, values);
    site.newDig.hidden = site.found < site.hidden;
  }

  function startDig(site) {
    site.built = true;
    site.face.textContent = '';
    site.found = 0;

    if (!site.specimens.length) {
      site.hidden = 0;
      site.face.hidden = true;
      site.newDig.hidden = true;
      site.status.textContent = strings.status_no_stock;
      return;
    }

    // Prefer specimens the shopper has not found yet.
    var logged = log[site.id] || [];
    var fresh = shuffle(
      site.specimens.filter(function (s) {
        return logged.indexOf(s.id) === -1;
      })
    );
    var seen = shuffle(
      site.specimens.filter(function (s) {
        return logged.indexOf(s.id) !== -1;
      })
    );
    var picks = fresh.concat(seen).slice(0, Math.min(perDig, ROCKS));
    var slots = shuffle(
      Array.apply(null, { length: ROCKS }).map(function (_, i) {
        return i;
      })
    ).slice(0, picks.length);
    site.hidden = picks.length;

    for (var i = 0; i < ROCKS; i++) {
      var rock = el('button', 'mine__rock');
      rock.type = 'button';
      rock.innerHTML = CRACKS;
      rock.dataset.hits = '0';
      rock.style.setProperty('--tilt', Math.floor(Math.random() * 4) * 90 + 'deg');
      rock._number = i + 1;
      rock._strength = 2 + (Math.random() < 0.4 ? 1 : 0);
      rock._specimen = slots.indexOf(i) === -1 ? null : picks[slots.indexOf(i)];
      rock._index = i;
      rock.setAttribute('aria-label', text(strings.rock, { n: rock._number }));
      site.face.appendChild(rock);
    }
    setStatus(site);
    start3d(site);
  }

  // Draw the rock face in 3D when the browser can; otherwise the flat tiles stay.
  function start3d(site) {
    if (!use3d) return;
    try {
      if (!site.stage) site.stage = engine.createStage(site.face, { rock: site.rock, color: site.color });
      site.stage.reset(ROCKS);
      site.stage.activate();
      site.face.classList.add('mine__face--3d');
    } catch (e) {
      use3d = false;
      site.stage = null;
      site.face.classList.remove('mine__face--3d');
    }
  }

  function strike(site, rock) {
    if (rock.dataset.state) return;

    var hits = parseInt(rock.dataset.hits, 10) + 1;
    rock.dataset.hits = String(hits);
    rock.classList.remove('is-struck');
    void rock.offsetWidth; // restart the animation
    rock.classList.add('is-struck');

    if (hits < rock._strength) {
      rock.setAttribute('aria-label', text(strings.rock_cracked, { n: rock._number }));
      if (site.stage) site.stage.strike(rock._index, hits);
      return;
    }

    var specimen = rock._specimen;
    if (site.stage) site.stage.breakOpen(rock._index, specimen);
    rock.setAttribute('aria-disabled', 'true');

    if (!specimen) {
      rock.dataset.state = 'empty';
      rock.setAttribute('aria-label', text(strings.rock_empty, { n: rock._number }));
      announce(strings.announce_empty);
      return;
    }

    rock.dataset.state = 'found';
    rock.setAttribute('aria-label', text(strings.rock_found, { n: rock._number, title: specimen.title }));
    if (specimen.image && !site.stage) {
      var img = el('img', 'mine__rock-image');
      img.src = specimen.image;
      img.alt = '';
      rock.appendChild(img);
    }

    site.found += 1;
    log[site.id] = log[site.id] || [];
    if (log[site.id].indexOf(specimen.id) === -1) log[site.id].push(specimen.id);
    saveLog();
    // In 3D, let the crystal appear in the rock before its card shows up.
    if (site.stage) {
      setTimeout(function () {
        addCard(site, specimen, true);
      }, 700);
    } else {
      addCard(site, specimen, true);
    }
    setStatus(site);
    updateCounts();
    announce(text(strings.announce_found, { title: specimen.title, price: specimen.price }));
  }

  /* Navigation --------------------------------------------------------------- */

  function route(moveFocus) {
    var id = location.hash.replace('#site-', '');
    var site = sites[id];

    mapView.hidden = !!site;
    Object.keys(sites).forEach(function (key) {
      sites[key].el.hidden = key !== id;
      if (key !== id && sites[key].stage) sites[key].stage.deactivate();
    });

    if (site) {
      if (!site.built) {
        loggedSpecimens(site).forEach(function (s) {
          addCard(site, s, false);
        });
        startDig(site);
      } else if (site.stage) {
        site.stage.activate();
      }
      if (moveFocus) site.el.querySelector('h2').focus();
    } else if (moveFocus) {
      var card = root.querySelector('.mine__site-card');
      if (card) card.focus();
    }
    if (moveFocus) root.scrollIntoView({ block: 'start' });
  }

  root.addEventListener('click', function (event) {
    var open = event.target.closest('[data-open-site]');
    if (open) {
      location.hash = 'site-' + open.dataset.openSite;
      return;
    }

    if (event.target.closest('[data-back]')) {
      history.pushState(null, '', location.pathname + location.search);
      route(true);
      return;
    }

    var siteEl = event.target.closest('[data-mine-site]');
    var site = siteEl && sites[siteEl.dataset.mineSite];

    var rock = event.target.closest('.mine__rock');
    if (rock && site) return strike(site, rock);

    if (event.target.closest('[data-new-dig]') && site) {
      startDig(site);
      var first = site.face.querySelector('.mine__rock');
      if (first) first.focus();
      return;
    }

    var soundToggle = event.target.closest('[data-sound-toggle]');
    if (soundToggle && engine) {
      engine.sound.setMuted(!engine.sound.muted);
      syncSound();
      return;
    }

    if (event.target.closest('[data-clear-log]')) {
      log = {};
      saveLog();
      Object.keys(sites).forEach(function (key) {
        sites[key].finds.textContent = '';
        sites[key].findsWrap.hidden = true;
      });
      updateCounts();
    }
  });

  function syncSound() {
    root.querySelectorAll('[data-sound-toggle]').forEach(function (button) {
      button.hidden = !use3d;
      button.setAttribute('aria-pressed', String(!engine.sound.muted));
      button.textContent = engine.sound.muted ? strings.sound_off : strings.sound_on;
    });
  }
  if (engine) syncSound();

  window.addEventListener('hashchange', function () {
    route(true);
  });
  window.addEventListener('popstate', function () {
    route(false);
  });

  updateCounts();
  route(false);
})();
