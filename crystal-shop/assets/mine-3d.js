/*
 * 3D rock face for the mining game (three.js, loaded before this file).
 *
 * This file only draws. Game rules, the clickable rock buttons and the shop
 * integration live in mine.js, which calls:
 *
 *   var stage = CrystalMine3D.createStage(faceElement, { rock: 'basalt', color: '#7b5ea7' });
 *   stage.reset(12);                 // new dig with 12 rocks
 *   stage.strike(index, hits);       // a rock was hit but not broken
 *   stage.breakOpen(index, specimen) // a rock broke; specimen is null for an empty pocket
 *   stage.activate() / stage.deactivate()
 *
 * Rocks sit on a flat grid that matches the button grid laid over the canvas,
 * so no ray picking is needed and keyboard/screen-reader play keeps working.
 */
(function () {
  'use strict';

  var THREE = window.THREE;
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var narrow = window.matchMedia ? window.matchMedia('(max-width: 479px)') : { matches: false };

  function supported() {
    if (!THREE) return false;
    try {
      return !!document.createElement('canvas').getContext('webgl2');
    } catch (e) {
      return false;
    }
  }

  /* Random and noise ----------------------------------------------------------- */

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash3(x, y, z) {
    var n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function smooth(t) {
    return t * t * (3 - 2 * t);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // Value noise in 3D, range 0..1.
  function noise3(x, y, z) {
    var ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    var fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz);
    return lerp(
      lerp(lerp(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), fx), lerp(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), fx), fy),
      lerp(lerp(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), fx), lerp(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), fx), fy),
      fz
    );
  }

  function fbm3(x, y, z, octaves) {
    var sum = 0, amp = 0.5, total = 0;
    for (var i = 0; i < octaves; i++) {
      sum += noise3(x, y, z) * amp;
      total += amp;
      x *= 2.03; y *= 2.03; z *= 2.03;
      amp *= 0.5;
    }
    return sum / total;
  }

  // Tileable 2D value noise for textures: lattice wraps every `period` cells.
  function pnoise2(x, y, period, seed) {
    var ix = Math.floor(x), iy = Math.floor(y);
    var fx = smooth(x - ix), fy = smooth(y - iy);
    var x0 = ((ix % period) + period) % period, x1 = (x0 + 1) % period;
    var y0 = ((iy % period) + period) % period, y1 = (y0 + 1) % period;
    return lerp(
      lerp(hash3(x0, y0, seed), hash3(x1, y0, seed), fx),
      lerp(hash3(x0, y1, seed), hash3(x1, y1, seed), fx),
      fy
    );
  }

  /* Shared GPU resources (one renderer for every dig site) ---------------------- */

  var shared = null;

  function buildRockTextures() {
    var size = 512;
    var height = new Float32Array(size * size);
    var x, y, i;

    for (y = 0; y < size; y++) {
      for (x = 0; x < size; x++) {
        var u = x / size, v = y / size;
        var h = 0, amp = 0.5, period = 4;
        for (var o = 0; o < 7; o++) {
          var n = pnoise2(u * period, v * period, period, o * 7.3);
          // ridged octaves give the sharp, fractured look of broken stone
          h += (o > 1 ? 1 - Math.abs(n * 2 - 1) : n) * amp;
          amp *= 0.55;
          period *= 2;
        }
        height[y * size + x] = h;
      }
    }

    var colorCanvas = document.createElement('canvas');
    var normalCanvas = document.createElement('canvas');
    colorCanvas.width = colorCanvas.height = normalCanvas.width = normalCanvas.height = size;
    var cctx = colorCanvas.getContext('2d');
    var nctx = normalCanvas.getContext('2d');
    var cdata = cctx.createImageData(size, size);
    var ndata = nctx.createImageData(size, size);
    var speck = rng(77);

    for (y = 0; y < size; y++) {
      for (x = 0; x < size; x++) {
        i = y * size + x;
        var hl = height[y * size + ((x + size - 1) % size)];
        var hr = height[y * size + ((x + 1) % size)];
        var hd = height[((y + size - 1) % size) * size + x];
        var hu = height[((y + 1) % size) * size + x];
        var dx = (hl - hr) * 9, dy = (hd - hu) * 9;
        var len = Math.sqrt(dx * dx + dy * dy + 1);
        ndata.data[i * 4] = (dx / len * 0.5 + 0.5) * 255;
        ndata.data[i * 4 + 1] = (dy / len * 0.5 + 0.5) * 255;
        ndata.data[i * 4 + 2] = (1 / len * 0.5 + 0.5) * 255;
        ndata.data[i * 4 + 3] = 255;

        // albedo: mottled grey, darker in the creases, with mineral speckle
        var g = 0.62 + (height[i] - 0.55) * 1.1;
        var s = speck();
        if (s > 0.992) g += 0.35;
        else if (s < 0.012) g -= 0.3;
        g = Math.max(0.12, Math.min(1, g)) * 255;
        cdata.data[i * 4] = cdata.data[i * 4 + 1] = cdata.data[i * 4 + 2] = g;
        cdata.data[i * 4 + 3] = 255;
      }
    }
    cctx.putImageData(cdata, 0, 0);
    nctx.putImageData(ndata, 0, 0);

    var map = new THREE.CanvasTexture(colorCanvas);
    map.colorSpace = THREE.SRGBColorSpace;
    var normalMap = new THREE.CanvasTexture(normalCanvas);
    [map, normalMap].forEach(function (t) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
    });
    return { map: map, normalMap: normalMap };
  }

  function spriteTexture(draw) {
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    draw(c.getContext('2d'));
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  function buildEnvironment(renderer) {
    // A dark cave lit by a few bright panels; gives crystals something to reflect.
    var scene = new THREE.Scene();
    var room = new THREE.Mesh(
      new THREE.BoxGeometry(20, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0x0c0d12, side: THREE.BackSide })
    );
    scene.add(room);
    function panel(color, strength, w, h, x, y, z) {
      var m = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide });
      m.color.multiplyScalar(strength);
      var mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
      mesh.position.set(x, y, z);
      mesh.lookAt(0, 0, 0);
      scene.add(mesh);
    }
    panel(0xffd9a8, 22, 5, 4, -6, 6, 7); // headlamp
    panel(0xa8c8ff, 9, 4, 7, 9, 1, 4); // cool rim
    panel(0xffffff, 30, 2, 2, 1, 9, 2); // top glint
    panel(0xff9a5a, 3, 8, 3, 0, -9, 3); // warm bounce from the floor
    var pmrem = new THREE.PMREMGenerator(renderer);
    var env = pmrem.fromScene(scene, 0.03).texture;
    pmrem.dispose();
    scene.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    return env;
  }

  // Indexed icosphere so displaced rocks shade smoothly.
  function icosphere(detail) {
    var t = (1 + Math.sqrt(5)) / 2;
    var verts = [
      [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t],
      [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
    ].map(function (v) {
      var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
      return [v[0] / l, v[1] / l, v[2] / l];
    });
    var faces = [
      [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
    ];
    for (var d = 0; d < detail; d++) {
      var cache = {};
      var next = [];
      var mid = function (a, b) {
        var key = a < b ? a + '_' + b : b + '_' + a;
        if (cache[key] !== undefined) return cache[key];
        var va = verts[a], vb = verts[b];
        var m = [va[0] + vb[0], va[1] + vb[1], va[2] + vb[2]];
        var l = Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2]);
        verts.push([m[0] / l, m[1] / l, m[2] / l]);
        return (cache[key] = verts.length - 1);
      };
      for (var f = 0; f < faces.length; f++) {
        var a = faces[f][0], b = faces[f][1], c = faces[f][2];
        var ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
        next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
      }
      faces = next;
    }
    return { verts: verts, faces: faces };
  }

  function getShared() {
    if (shared) return shared;

    var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = 'mine__canvas';
    renderer.domElement.setAttribute('aria-hidden', 'true');

    var rockTex = buildRockTextures();

    shared = {
      renderer: renderer,
      env: buildEnvironment(renderer),
      rockTex: rockTex,
      sphereHi: icosphere(5),
      sphereMid: icosphere(3),
      sphereLo: icosphere(1),
      soft: spriteTexture(function (ctx) {
        var g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 128, 128);
      }),
      star: spriteTexture(function (ctx) {
        var g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.12, 'rgba(255,255,255,0.7)');
        g.addColorStop(0.4, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 128, 128);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.moveTo(64, 0); ctx.lineTo(68, 60); ctx.lineTo(128, 64); ctx.lineTo(68, 68);
        ctx.lineTo(64, 128); ctx.lineTo(60, 68); ctx.lineTo(0, 64); ctx.lineTo(60, 60);
        ctx.closePath();
        ctx.fill();
      }),
      flash: spriteTexture(function (ctx) {
        ctx.fillStyle = '#04060a';
        ctx.fillRect(0, 0, 128, 128);
        ctx.globalCompositeOperation = 'lighter';
        [['#1486ff', 44, 52, 58], ['#12d6c0', 80, 70, 46], ['#f2b21c', 92, 38, 34], ['#2a4bff', 30, 92, 40]].forEach(function (b) {
          var g = ctx.createRadialGradient(b[1], b[2], 0, b[1], b[2], b[3]);
          g.addColorStop(0, b[0]);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, 128, 128);
        });
      }),
      active: null,
    };
    return shared;
  }

  /* Rock ------------------------------------------------------------------------ */

  var ROCK_TYPES = {
    basalt: { base: 0x57524d, tint: 0.1 },
    granite: { base: 0xa39c93, tint: 0.06 },
    sandstone: { base: 0xc19a63, tint: 0.05 },
    limestone: { base: 0xb09a7a, tint: 0.06 },
    slate: { base: 0x6d7379, tint: 0.08 },
  };

  // Broken stone: a sphere cut by random planes (flat fracture faces with hard
  // edges), then roughened. Flattened at the back so it beds into the wall.
  // `rough` 0 gives a smooth pebble instead.
  function rockGeometry(sphere, seed, sx, sy, sz, color, rough, flat) {
    var n = sphere.verts.length;
    var pos = new Float32Array(n * 3);
    var uv = new Float32Array(n * 2);
    var col = new Float32Array(n * 3);
    var off = seed * 17.13;
    var rand = rng(Math.floor(seed * 7919) + 11);
    var planes = [];
    var cuts = rough > 0.1 ? 14 : 0;
    for (var c = 0; c < cuts; c++) {
      var pz = rand() * 2 - 1, pa = rand() * Math.PI * 2, pr = Math.sqrt(1 - pz * pz);
      planes.push([Math.cos(pa) * pr, Math.sin(pa) * pr, pz, 0.62 + rand() * 0.3]);
    }
    for (var i = 0; i < n; i++) {
      var v = sphere.verts[i];
      var lump = fbm3(v[0] * 1.2 + off, v[1] * 1.2 + off, v[2] * 1.2, 3);
      var ridge = 1 - Math.abs(fbm3(v[0] * 3.1 - off, v[1] * 3.1, v[2] * 3.1 + off, 3) * 2 - 1);
      var r = cuts ? 1.12 : 0.8 + lump * 0.4;
      var facet = 0;
      for (c = 0; c < cuts; c++) {
        var dot = v[0] * planes[c][0] + v[1] * planes[c][1] + v[2] * planes[c][2];
        if (dot > 0.05 && planes[c][3] / dot < r) {
          r = planes[c][3] / dot;
          facet = c + 1;
        }
      }
      if (cuts) r *= 1 + (lump - 0.5) * 0.16 + (ridge - 0.6) * rough * 0.22;
      else r += (ridge - 0.6) * rough * 3;
      var x = v[0] * r * sx, y = v[1] * r * sy, z = v[2] * r * sz;
      if (z < 0) z *= 0.45;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      uv[i * 2] = x * 1.3 + off; uv[i * 2 + 1] = y * 1.3 - off;
      // each fracture face weathers a slightly different shade
      var shade = 0.74 + ((facet * 37) % 11) * 0.028 + (ridge - 0.6) * 0.3 + (lump - 0.5) * 0.25;
      col[i * 3] = color.r * shade; col[i * 3 + 1] = color.g * shade; col[i * 3 + 2] = color.b * shade;
    }
    var index = new Uint16Array(sphere.faces.length * 3);
    for (var f = 0; f < sphere.faces.length; f++) {
      index[f * 3] = sphere.faces[f][0]; index[f * 3 + 1] = sphere.faces[f][1]; index[f * 3 + 2] = sphere.faces[f][2];
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    if (flat) g = g.toNonIndexed(); // hard-edged chips
    g.computeVertexNormals();
    return g;
  }

  /* Crystals --------------------------------------------------------------------- */

  // Faceted prism growing along +y from y=0. tip > 0 adds a pointed termination.
  function prismGeometry(sides, radius, height, tip, rand, taper) {
    var bottom = [], top = [], tris = [];
    var skew = rand() * Math.PI;
    for (var i = 0; i < sides; i++) {
      var a = skew + (i / sides) * Math.PI * 2;
      var r = radius * (0.9 + rand() * 0.2);
      bottom.push([Math.cos(a) * r, 0, Math.sin(a) * r]);
      top.push([Math.cos(a) * r * taper, height * (0.96 + rand() * 0.08), Math.sin(a) * r * taper]);
    }
    var apex = [(rand() - 0.5) * radius * 0.5, height + tip, (rand() - 0.5) * radius * 0.5];
    for (i = 0; i < sides; i++) {
      var j = (i + 1) % sides;
      tris.push([bottom[i], bottom[j], top[j]], [bottom[i], top[j], top[i]]);
      tris.push([top[i], top[j], apex]);
    }
    var pos = [];
    var mid = [0, height * 0.5, 0];
    tris.forEach(function (t) {
      // make every face point outwards regardless of winding
      var ux = t[1][0] - t[0][0], uy = t[1][1] - t[0][1], uz = t[1][2] - t[0][2];
      var vx = t[2][0] - t[0][0], vy = t[2][1] - t[0][1], vz = t[2][2] - t[0][2];
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      var cx = (t[0][0] + t[1][0] + t[2][0]) / 3 - mid[0];
      var cy = (t[0][1] + t[1][1] + t[2][1]) / 3 - mid[1];
      var cz = (t[0][2] + t[1][2] + t[2][2]) / 3 - mid[2];
      var order = nx * cx + ny * cy + nz * cz < 0 ? [0, 2, 1] : [0, 1, 2];
      order.forEach(function (k) {
        pos.push(t[k][0], t[k][1], t[k][2]);
      });
    });
    var uv = [];
    for (i = 0; i < pos.length; i += 3) uv.push(pos[i] / (radius * 2.4) + 0.5, pos[i + 2] / (radius * 2.4) + 0.5);
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals(); // non-indexed, so facets stay flat
    return g;
  }

  function gemMaterial(env, o) {
    return new THREE.MeshPhysicalMaterial({
      color: o.color || 0xffffff,
      roughness: o.roughness == null ? 0.05 : o.roughness,
      metalness: o.metalness || 0,
      transmission: o.transmission == null ? 0.6 : o.transmission,
      thickness: o.thickness || 0.18,
      ior: o.ior || 1.55,
      attenuationColor: new THREE.Color(o.tint || 0xffffff),
      attenuationDistance: o.depth || 10,
      specularIntensity: 1,
      clearcoat: o.clearcoat || 0,
      clearcoatRoughness: 0.1,
      sheen: o.sheen || 0,
      sheenColor: new THREE.Color(o.sheenColor || 0x000000),
      sheenRoughness: 0.35,
      iridescence: o.iridescence || 0,
      iridescenceIOR: 1.9,
      iridescenceThicknessRange: [180, 620],
      emissive: new THREE.Color(o.glow || 0x000000),
      emissiveIntensity: o.glowStrength || 0,
      envMap: env,
      envMapIntensity: o.env == null ? 2.4 : o.env,
    });
  }

  var TITLE_COLORS = { pink: 0xe58fb4, purple: 0x8a55d6, blue: 0x4f9fe6, green: 0x3fbf86, yellow: 0xe6c84f };

  function mineralKind(specimen) {
    var text = ((specimen.species || '') + ' ' + (specimen.title || '')).toLowerCase();
    var kinds = ['amethyst', 'aquamarine', 'fluorite', 'desert glass', 'vanadinite', 'moonstone', 'labradorite', 'quartz'];
    for (var i = 0; i < kinds.length; i++) if (text.indexOf(kinds[i]) !== -1) return kinds[i];
    return 'generic';
  }

  // Returns { group, glow } for a specimen. The group grows along +y from its origin.
  function buildCrystal(specimen, siteColor, res, rand) {
    var kind = mineralKind(specimen);
    var group = new THREE.Group();
    var text = (specimen.title || '').toLowerCase();
    var mat, glow, i, mesh;

    function add(geometry, material, x, y, z, rx, rz) {
      var m = new THREE.Mesh(geometry, material);
      m.position.set(x, y, z);
      m.rotation.set(rx || 0, rand() * Math.PI, rz || 0);
      m.castShadow = true;
      group.add(m);
      return m;
    }

    // A radiating spray of points: quartz, amethyst, aquamarine, generic.
    function spray(count, radius, length, tip, spread, material, sides) {
      for (var k = 0; k < count; k++) {
        var main = k === 0;
        var a = rand() * Math.PI * 2;
        var d = main ? 0 : 0.06 + rand() * 0.2;
        var scale = main ? 1 : 0.4 + rand() * 0.5;
        var g = prismGeometry(sides || 6, radius * scale, length * scale, tip * scale, rand, 0.86);
        var tilt = main ? 0.08 : spread * (0.45 + rand() * 0.55);
        var m = add(g, material, Math.cos(a) * d, -0.03, Math.sin(a) * d);
        m.rotation.set(0, 0, 0);
        m.rotateOnAxis(new THREE.Vector3(Math.sin(a), 0, -Math.cos(a)).normalize(), tilt);
      }
    }

    if (kind === 'quartz') {
      mat = gemMaterial(res.env, { color: 0xffffff, transmission: 0.92, tint: 0xeef3ff, depth: 3, roughness: 0.02, glow: 0x66707f, glowStrength: 0.25, clearcoat: 1 });
      spray(6, 0.1, 0.5, 0.17, 0.9, mat);
      glow = 0xdfeaff;
    } else if (kind === 'amethyst') {
      mat = gemMaterial(res.env, { color: 0x8d55ee, transmission: 0.62, tint: 0x7a3fe0, depth: 0.45, roughness: 0.03, glow: 0x4a16a8, glowStrength: 0.3, clearcoat: 1 });
      spray(9, 0.105, 0.3, 0.15, 1.0, mat);
      glow = 0xa46bff;
    } else if (kind === 'aquamarine') {
      mat = gemMaterial(res.env, { color: 0x7fdde8, transmission: 0.68, tint: 0x3fb9cc, depth: 0.55, roughness: 0.03, glow: 0x147f90, glowStrength: 0.25, clearcoat: 1 });
      spray(4, 0.075, 0.58, 0.015, 0.55, mat);
      glow = 0x7fe6f2;
    } else if (kind === 'fluorite') {
      var hue = 0x3fbf86;
      Object.keys(TITLE_COLORS).forEach(function (word) {
        if (text.indexOf(word) !== -1) hue = TITLE_COLORS[word];
      });
      mat = gemMaterial(res.env, { color: new THREE.Color(hue).lerp(new THREE.Color(0xffffff), 0.12).getHex(), transmission: 0.6, tint: hue, depth: 0.5, roughness: 0.06, glow: hue, glowStrength: 0.12, clearcoat: 1 });
      var turn = rand() * Math.PI;
      for (i = 0; i < 9; i++) {
        var s = i === 0 ? 0.22 : 0.07 + rand() * 0.11;
        var a2 = rand() * Math.PI * 2, d2 = i === 0 ? 0 : 0.1 + rand() * 0.13;
        mesh = add(new THREE.BoxGeometry(s, s, s), mat, Math.cos(a2) * d2, s * 0.3 + rand() * 0.06, Math.sin(a2) * d2);
        // fluorite cubes grow roughly parallel to each other
        mesh.rotation.set((rand() - 0.5) * 0.25, turn + (rand() - 0.5) * 0.3, (rand() - 0.5) * 0.25);
      }
      glow = hue;
    } else if (kind === 'desert glass') {
      // wind-polished natural glass: a smooth, pitted, translucent yellow lump
      var gg = rockGeometry(res.sphereHi, rand() * 99, 0.26, 0.2, 0.2, new THREE.Color(1, 1, 1), 0.09);
      gg.deleteAttribute('color');
      mat = gemMaterial(res.env, { color: 0xe6cb4e, transmission: 0.7, tint: 0xd9b830, depth: 0.5, roughness: 0.32, ior: 1.46, glow: 0x8a6c10, glowStrength: 0.28, clearcoat: 0.25 });
      mat.normalMap = res.rockTex.normalMap;
      mat.normalScale = new THREE.Vector2(0.35, 0.35);
      mesh = add(gg, mat, 0, 0.18, 0, 0.3, 0.2);
      glow = 0xffe27a;
    } else if (kind === 'vanadinite') {
      // bright red hexagonal plates on a pale matrix
      mat = gemMaterial(res.env, { color: 0xd42a10, transmission: 0, roughness: 0.14, clearcoat: 1, env: 1.6, glow: 0x8a1404, glowStrength: 0.45 });
      for (i = 0; i < 16; i++) {
        var pr = 0.05 + rand() * 0.06;
        var a3 = rand() * Math.PI * 2, d3 = Math.sqrt(rand()) * 0.24;
        mesh = add(prismGeometry(6, pr, pr * (0.35 + rand() * 0.5), 0.004, rand, 1), mat, Math.cos(a3) * d3, 0.02 + rand() * 0.06, Math.sin(a3) * d3, (rand() - 0.5) * 1.6, (rand() - 0.5) * 1.6);
      }
      glow = 0xff5a2a;
    } else if (kind === 'moonstone') {
      var mg = rockGeometry(res.sphereHi, rand() * 99, 0.22, 0.17, 0.19, new THREE.Color(1, 1, 1), 0.02);
      mg.deleteAttribute('color');
      mat = gemMaterial(res.env, { color: 0xe9eef8, transmission: 0.5, tint: 0xbcd4ff, depth: 0.4, thickness: 0.4, roughness: 0.16, sheen: 1, sheenColor: 0x3f7dff, clearcoat: 1, iridescence: 0.7, glow: 0x2a55c8, glowStrength: 0.3 });
      add(mg, mat, 0, 0.16, 0, 0.2, 0.1);
      glow = 0x9fc0ff;
    } else if (kind === 'labradorite') {
      // dark feldspar slab with a play-of-colour flash
      mat = gemMaterial(res.env, { color: 0x30363c, transmission: 0, roughness: 0.18, metalness: 0.3, iridescence: 1, clearcoat: 1, env: 2, glow: 0xffffff, glowStrength: 1.15 });
      mat.emissiveMap = res.flash; // the blue-gold play of colour
      mesh = add(prismGeometry(7, 0.27, 0.1, 0.012, rand, 0.9), mat, 0, 0.1, 0, -0.5, 0.15);
      mesh.scale.set(1, 1, 0.72);
      glow = 0x3fb6ff;
    } else {
      var c = new THREE.Color(siteColor);
      mat = gemMaterial(res.env, { color: c.clone().lerp(new THREE.Color(0xffffff), 0.45).getHex(), tint: c.getHex(), depth: 0.5, roughness: 0.05, glow: c.getHex(), glowStrength: 0.4, clearcoat: 1 });
      spray(6, 0.1, 0.4, 0.15, 0.9, mat);
      glow = c.getHex();
    }

    return { group: group, glow: glow };
  }

  /* Sound (synthesised, no audio files) ------------------------------------------ */

  var MUTE_KEY = 'crystal_mine_muted';
  var sound = {
    ctx: null,
    muted: (function () {
      try {
        return localStorage.getItem(MUTE_KEY) === '1';
      } catch (e) {
        return false;
      }
    })(),
    setMuted: function (value) {
      sound.muted = !!value;
      try {
        localStorage.setItem(MUTE_KEY, value ? '1' : '0');
      } catch (e) {}
    },
    ready: function () {
      if (sound.muted) return null;
      try {
        if (!sound.ctx) sound.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (sound.ctx.state === 'suspended') sound.ctx.resume();
      } catch (e) {
        return null;
      }
      return sound.ctx;
    },
    noise: function (ctx, duration) {
      var buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      var src = ctx.createBufferSource();
      src.buffer = buffer;
      return src;
    },
    burst: function (ctx, when, duration, freq, q, gain, type) {
      var src = sound.noise(ctx, duration);
      var filter = ctx.createBiquadFilter();
      filter.type = type || 'bandpass';
      filter.frequency.value = freq;
      filter.Q.value = q;
      var amp = ctx.createGain();
      amp.gain.setValueAtTime(gain, when);
      amp.gain.exponentialRampToValueAtTime(0.001, when + duration);
      src.connect(filter).connect(amp).connect(ctx.destination);
      src.start(when);
    },
    tone: function (ctx, when, freq, duration, gain, type) {
      var osc = ctx.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, when);
      var amp = ctx.createGain();
      amp.gain.setValueAtTime(0.0001, when);
      amp.gain.exponentialRampToValueAtTime(gain, when + 0.01);
      amp.gain.exponentialRampToValueAtTime(0.0001, when + duration);
      osc.connect(amp).connect(ctx.destination);
      osc.start(when);
      osc.stop(when + duration + 0.05);
      return osc;
    },
    strike: function () {
      var ctx = sound.ready();
      if (!ctx) return;
      var t = ctx.currentTime;
      sound.burst(ctx, t, 0.09, 2600 + Math.random() * 900, 2.5, 0.5); // steel on stone
      sound.tone(ctx, t, 3100 + Math.random() * 500, 0.16, 0.06, 'triangle'); // ring of the pick
      var thud = sound.tone(ctx, t, 120, 0.14, 0.5);
      thud.frequency.exponentialRampToValueAtTime(48, t + 0.13);
    },
    crumble: function () {
      var ctx = sound.ready();
      if (!ctx) return;
      var t = ctx.currentTime;
      sound.burst(ctx, t, 0.55, 700, 0.6, 0.55, 'lowpass');
      for (var i = 0; i < 9; i++) {
        sound.burst(ctx, t + 0.05 + Math.random() * 0.5, 0.04, 900 + Math.random() * 2400, 4, 0.18);
      }
      var thud = sound.tone(ctx, t, 90, 0.3, 0.6);
      thud.frequency.exponentialRampToValueAtTime(36, t + 0.28);
    },
    chime: function () {
      var ctx = sound.ready();
      if (!ctx) return;
      var t = ctx.currentTime + 0.22;
      [1318.5, 1975.5, 2637].forEach(function (f, i) {
        sound.tone(ctx, t + i * 0.09, f, 1.1, 0.09);
        sound.tone(ctx, t + i * 0.09, f * 2.01, 0.6, 0.025);
      });
    },
  };

  /* Stage: one dig site's scene --------------------------------------------------- */

  function createStage(face, options) {
    var res = getShared();
    var rockType = ROCK_TYPES[options.rock] || ROCK_TYPES.basalt;
    var siteColor = new THREE.Color(options.color || '#8d877d');
    var rockColor = new THREE.Color(rockType.base).lerp(siteColor, rockType.tint);

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070605);
    scene.environment = res.env;
    var camera = new THREE.PerspectiveCamera(28, 4 / 3, 0.1, 60);

    var rockMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: res.rockTex.map,
      normalMap: res.rockTex.normalMap,
      normalScale: new THREE.Vector2(2.2, 2.2),
      roughness: 0.93,
      metalness: 0,
      envMapIntensity: 0.22,
    });
    var crackMaterial = new THREE.MeshBasicMaterial({ color: 0x050403, side: THREE.DoubleSide });

    scene.add(new THREE.HemisphereLight(0xa9b6cc, 0x33261a, 0.32));
    var key = new THREE.SpotLight(0xffdcb0, 420, 40, 0.7, 0.85, 2);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.03;
    scene.add(key, key.target);
    var rim = new THREE.DirectionalLight(0x8fa8d6, 0.28);
    rim.position.set(6, -2, 3);
    scene.add(rim);
    var hoverLight = new THREE.PointLight(0xfff0d2, 0, 2.6, 2);
    scene.add(hoverLight);

    var content = new THREE.Group(); // everything rebuilt per dig
    scene.add(content);

    var stage = {
      cols: 4, rows: 3, count: 0,
      rocks: [],     // { hits, broken, specimen, mesh, cracks, home }
      pocketLights: [],
      tweens: [], debris: [], puffs: [], twinkles: [],
      shake: 0, hover: -1, hoverLevel: 0,
      pointer: { x: 0, y: 0 },
      running: false, last: 0, seed: 1,
    };

    function cell(i) {
      var c = i % stage.cols, r = Math.floor(i / stage.cols);
      return { x: c - (stage.cols - 1) / 2, y: (stage.rows - 1) / 2 - r };
    }

    function disposeContent() {
      content.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material && o.material !== rockMaterial && o.material !== crackMaterial) o.material.dispose();
      });
      content.clear();
      stage.tweens.length = stage.debris.length = stage.puffs.length = stage.twinkles.length = 0;
      stage.pocketLights.length = 0;
    }

    function buildWall() {
      var w = stage.cols + 3, h = stage.rows + 3;
      var g = new THREE.PlaneGeometry(w, h, stage.cols * 36, stage.rows * 36);
      var pos = g.attributes.position, uv = g.attributes.uv;
      var col = new Float32Array(pos.count * 3);
      for (var i = 0; i < pos.count; i++) {
        var x = pos.getX(i), y = pos.getY(i);
        // sockets the rocks sit in
        var gx = x + (stage.cols - 1) / 2, gy = (stage.rows - 1) / 2 - y;
        var cx = Math.min(stage.cols - 1, Math.max(0, Math.round(gx)));
        var cy = Math.min(stage.rows - 1, Math.max(0, Math.round(gy)));
        var d = Math.sqrt((gx - cx) * (gx - cx) + (gy - cy) * (gy - cy));
        var socket = 1 - Math.min(1, Math.max(0, (d - 0.16) / 0.36));
        socket = smooth(socket);
        var rough = fbm3(x * 1.1 + stage.seed, y * 1.1, stage.seed, 4);
        var fine = fbm3(x * 4.5, y * 4.5 + stage.seed, 3.3, 3);
        pos.setZ(i, -0.12 + (rough - 0.5) * 0.5 + (fine - 0.5) * 0.12 - socket * 0.42);
        uv.setXY(i, x * 0.95, y * 0.95);
        var shade = (0.5 + rough * 0.45) * (1 - socket * 0.72);
        col[i * 3] = rockColor.r * shade; col[i * 3 + 1] = rockColor.g * shade; col[i * 3 + 2] = rockColor.b * shade;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.computeVertexNormals();
      var wall = new THREE.Mesh(g, rockMaterial);
      wall.receiveShadow = true;
      content.add(wall);
    }

    function buildRock(i) {
      var rand = rng(stage.seed * 1000 + i * 31 + 7);
      var p = cell(i);
      var tint = rockColor.clone().multiplyScalar(0.92 + rand() * 0.22);
      var g = rockGeometry(res.sphereHi, stage.seed * 13 + i * 3.7, 0.58 + rand() * 0.05, 0.58 + rand() * 0.05, 0.4 + rand() * 0.12, tint, 0.5);
      var mesh = new THREE.Mesh(g, rockMaterial);
      mesh.position.set(p.x + (rand() - 0.5) * 0.04, p.y + (rand() - 0.5) * 0.04, 0.02);
      mesh.rotation.z = rand() * Math.PI * 2;
      mesh.castShadow = mesh.receiveShadow = true;
      content.add(mesh);
      return mesh;
    }

    // A jagged dark ribbon draped over the front of a rock.
    var caster = new THREE.Raycaster();
    function addCrack(rock, i, level) {
      var rand = rng(stage.seed * 500 + i * 97 + level * 13);
      var p = cell(i);
      var mesh = rock.mesh;
      mesh.updateMatrixWorld(true);
      var lines = [];
      var angle = rand() * Math.PI;
      function walk(x, y, dir, steps, width) {
        var pts = [];
        for (var s = 0; s < steps; s++) {
          caster.set(new THREE.Vector3(x, y, 3), new THREE.Vector3(0, 0, -1));
          var hit = caster.intersectObject(mesh, false)[0];
          if (!hit) break;
          var local = mesh.worldToLocal(hit.point.clone().add(new THREE.Vector3(0, 0, 0.006)));
          pts.push({ p: local, w: width * (1 - (s / steps) * 0.85) });
          dir += (rand() - 0.5) * (rand() < 0.25 ? 2.6 : 0.9);
          var step = 0.02 + rand() * 0.03;
          x += Math.cos(dir) * step; y += Math.sin(dir) * step;
        }
        if (pts.length > 1) lines.push(pts);
        return pts;
      }
      if (level === 1) {
        var ox = p.x + (rand() - 0.5) * 0.1, oy = p.y + (rand() - 0.5) * 0.1;
        walk(ox, oy, angle, 14, 0.007);
        walk(ox, oy, angle + Math.PI, 14, 0.007);
      } else {
        for (var b = 0; b < 4; b++) {
          var a = rand() * Math.PI * 2;
          walk(p.x + Math.cos(a) * 0.08, p.y + Math.sin(a) * 0.08, a + (rand() - 0.5), 11, 0.0055);
        }
      }
      var verts = [];
      lines.forEach(function (pts) {
        for (var k = 0; k < pts.length - 1; k++) {
          var a0 = pts[k], a1 = pts[k + 1];
          var dx = a1.p.x - a0.p.x, dy = a1.p.y - a0.p.y;
          var l = Math.sqrt(dx * dx + dy * dy) || 1;
          var nx = -dy / l, ny = dx / l;
          var q = [
            [a0.p.x + nx * a0.w, a0.p.y + ny * a0.w, a0.p.z], [a0.p.x - nx * a0.w, a0.p.y - ny * a0.w, a0.p.z],
            [a1.p.x + nx * a1.w, a1.p.y + ny * a1.w, a1.p.z], [a1.p.x - nx * a1.w, a1.p.y - ny * a1.w, a1.p.z],
          ];
          [0, 1, 2, 2, 1, 3].forEach(function (n) {
            verts.push(q[n][0], q[n][1], q[n][2]);
          });
        }
      });
      if (!verts.length) return;
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      var crack = new THREE.Mesh(g, crackMaterial);
      mesh.add(crack);
    }

    function fillPocket(rock, i, animate) {
      var p = cell(i);
      var rand = rng(stage.seed * 300 + i * 53 + 3);
      var holder = new THREE.Group();
      holder.position.set(p.x, p.y - 0.26, -0.3);
      content.add(holder);

      // loose rubble in every opened pocket
      for (var k = 0; k < 4; k++) {
        var s = 0.03 + rand() * rand() * 0.09;
        var pebble = new THREE.Mesh(
          rockGeometry(res.sphereMid, rand() * 50, s, s * 0.8, s, rockColor.clone().multiplyScalar(0.6 + rand() * 0.4), 0.4),
          rockMaterial
        );
        pebble.position.set((rand() - 0.5) * 0.7, -0.1 + rand() * 0.06, 0.05 + rand() * 0.25);
        pebble.rotation.set(rand() * 6, rand() * 6, rand() * 6);
        pebble.castShadow = true;
        holder.add(pebble);
      }
      if (!rock.specimen) return;

      var built = buildCrystal(rock.specimen, siteColor, res, rand);
      var crystal = built.group;
      crystal.rotation.x = 0.95; // lean out of the pocket toward the camera
      crystal.rotation.z = (rand() - 0.5) * 0.5;
      holder.add(crystal);

      var glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: res.soft, color: built.glow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      glow.position.set(0, 0.3, 0.1);
      glow.scale.setScalar(1.15);
      holder.add(glow);

      var light = stage.pocketLights.filter(function (l) { return !l.userData.used; })[0];
      if (light) {
        light.userData.used = true;
        light.color.set(built.glow);
        light.position.set(p.x, p.y + 0.02, -0.12); // inside the pocket, behind the crystal
      }

      for (k = 0; k < 4; k++) {
        var star = new THREE.Sprite(new THREE.SpriteMaterial({
          map: res.star, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
        }));
        star.position.set(p.x + (rand() - 0.5) * 0.4, p.y + (rand() - 0.3) * 0.4, 0.3);
        star.scale.setScalar(0.1 + rand() * 0.12);
        content.add(star);
        stage.twinkles.push({ sprite: star, phase: rand() * 6, speed: 1.4 + rand() * 1.8 });
      }

      function settle(k) {
        var e = 1 - Math.pow(1 - k, 3);
        crystal.scale.setScalar((0.55 + e * 0.45) * 1.5);
        glow.material.opacity = 0.1 + (1 - k) * 0.75;
        if (light) light.intensity = 0.7 + (1 - k) * 5;
      }
      if (animate && !reducedMotion) stage.tweens.push({ t: 0, dur: 0.9, update: settle });
      else settle(1);
    }

    function layout() {
      var cols = narrow.matches ? 3 : 4;
      stage.cols = cols;
      stage.rows = Math.ceil(stage.count / cols) || 3;
      camera.aspect = stage.cols / stage.rows;
      camera.position.set(0, 0, stage.rows / 2 / Math.tan((camera.fov * Math.PI) / 360));
      camera.updateProjectionMatrix();
      stage.home = camera.position.clone();
      key.position.set(-stage.cols * 1.05, stage.rows * 1.2, camera.position.z * 0.5);
      key.target.position.set(stage.cols * 0.1, -stage.rows * 0.08, 0);
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 30;
    }

    function rebuild() {
      disposeContent();
      layout();
      buildWall();
      for (var n = 0; n < 6; n++) {
        var l = new THREE.PointLight(0xffffff, 0, 1.5, 2);
        l.userData.used = false;
        content.add(l);
        stage.pocketLights.push(l);
      }
      stage.rocks.forEach(function (rock, i) {
        rock.mesh = null;
        if (rock.broken) return fillPocket(rock, i, false);
        rock.mesh = buildRock(i);
        rock.home = rock.mesh.position.clone();
        if (rock.hits >= 1) addCrack(rock, i, 1);
        if (rock.hits >= 2) addCrack(rock, i, 2);
      });

      // dust hanging in the lamp light
      var count = 140, pts = new Float32Array(count * 3), rand = rng(stage.seed + 5);
      for (var k = 0; k < count; k++) {
        pts[k * 3] = (rand() - 0.5) * (stage.cols + 1);
        pts[k * 3 + 1] = (rand() - 0.5) * (stage.rows + 1);
        pts[k * 3 + 2] = 0.5 + rand() * camera.position.z * 0.6;
      }
      var mg = new THREE.BufferGeometry();
      mg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      stage.motes = new THREE.Points(mg, new THREE.PointsMaterial({
        map: res.soft, color: 0xffe2b8, size: 0.035, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      content.add(stage.motes);
      resize();
    }

    function burst(i, strength) {
      if (reducedMotion) return;
      var p = cell(i), k;
      for (k = 0; k < strength; k++) {
        var s = 0.025 + Math.random() * Math.random() * 0.09;
        var m = new THREE.Mesh(
          rockGeometry(res.sphereLo, Math.random() * 99, s, s * (0.5 + Math.random() * 0.5), s * 0.8, rockColor.clone().multiplyScalar(0.7 + Math.random() * 0.4), 0.5, true),
          rockMaterial
        );
        m.position.set(p.x + (Math.random() - 0.5) * 0.5, p.y + (Math.random() - 0.5) * 0.5, 0.25 + Math.random() * 0.2);
        m.castShadow = true;
        content.add(m);
        stage.debris.push({
          mesh: m, life: 0, max: 1.1 + Math.random() * 0.6,
          v: new THREE.Vector3((Math.random() - 0.5) * 2.4, 0.6 + Math.random() * 2.2, 0.8 + Math.random() * 2.4),
          spin: new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9),
        });
      }
      var dustColor = rockColor.clone().lerp(new THREE.Color(0xd9cbb5), 0.55);
      for (k = 0; k < Math.ceil(strength / 2); k++) {
        var puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: res.soft, color: dustColor, transparent: true, opacity: 0.5, depthWrite: false }));
        puff.position.set(p.x + (Math.random() - 0.5) * 0.4, p.y + (Math.random() - 0.5) * 0.4, 0.4 + Math.random() * 0.3);
        puff.scale.setScalar(0.3);
        content.add(puff);
        stage.puffs.push({
          sprite: puff, life: 0, max: 0.9 + Math.random() * 0.7, grow: 0.9 + Math.random() * 0.9,
          v: new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.15 + Math.random() * 0.3, 0.2),
        });
      }
      // sparks off the pick
      for (k = 0; k < 7; k++) {
        var spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: res.soft, color: 0xffc46b, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }));
        spark.position.set(p.x, p.y, 0.45);
        spark.scale.setScalar(0.035);
        content.add(spark);
        stage.puffs.push({
          sprite: spark, life: 0, max: 0.25 + Math.random() * 0.25, grow: 0, gravity: 5,
          v: new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.2) * 4, 1 + Math.random() * 2),
        });
      }
    }

    function resize() {
      var w = face.clientWidth, h = face.clientHeight;
      if (!w || !h || res.active !== stage) return;
      res.renderer.setSize(w, h, false);
    }

    function frame(now) {
      if (!stage.running) return;
      requestAnimationFrame(frame);
      var dt = Math.min(0.05, (now - stage.last) / 1000 || 0.016) * (window.__mineTimeScale || 1);
      stage.last = now;
      var t = now / 1000, i;

      for (i = stage.tweens.length - 1; i >= 0; i--) {
        var tw = stage.tweens[i];
        tw.t += dt;
        tw.update(Math.min(1, tw.t / tw.dur));
        if (tw.t >= tw.dur) stage.tweens.splice(i, 1);
      }
      for (i = stage.debris.length - 1; i >= 0; i--) {
        var d = stage.debris[i];
        d.life += dt;
        d.v.y -= 7.5 * dt;
        d.mesh.position.addScaledVector(d.v, dt);
        d.mesh.rotation.x += d.spin.x * dt; d.mesh.rotation.y += d.spin.y * dt; d.mesh.rotation.z += d.spin.z * dt;
        var fade = Math.max(0, 1 - Math.max(0, d.life - d.max * 0.6) / (d.max * 0.4));
        d.mesh.scale.setScalar(fade);
        if (d.life >= d.max) {
          content.remove(d.mesh);
          d.mesh.geometry.dispose();
          stage.debris.splice(i, 1);
        }
      }
      for (i = stage.puffs.length - 1; i >= 0; i--) {
        var pf = stage.puffs[i];
        pf.life += dt;
        if (pf.gravity) pf.v.y -= pf.gravity * dt;
        pf.sprite.position.addScaledVector(pf.v, dt);
        if (pf.grow) pf.sprite.scale.addScalar(pf.grow * dt);
        pf.sprite.material.opacity = (pf.gravity ? 1 : 0.5) * Math.max(0, 1 - pf.life / pf.max);
        if (pf.life >= pf.max) {
          content.remove(pf.sprite);
          pf.sprite.material.dispose();
          stage.puffs.splice(i, 1);
        }
      }
      stage.twinkles.forEach(function (tw2) {
        var s = Math.sin(t * tw2.speed + tw2.phase);
        tw2.sprite.material.opacity = reducedMotion ? 0.35 : Math.pow(Math.max(0, s), 6);
        tw2.sprite.material.rotation = t * 0.3 + tw2.phase;
      });
      if (stage.motes && !reducedMotion) {
        var arr = stage.motes.geometry.attributes.position;
        for (i = 0; i < arr.count; i++) {
          var y = arr.getY(i) + dt * (0.02 + (i % 5) * 0.006);
          if (y > (stage.rows + 1) / 2) y = -(stage.rows + 1) / 2;
          arr.setY(i, y);
          arr.setX(i, arr.getX(i) + Math.sin(t * 0.4 + i) * dt * 0.02);
        }
        arr.needsUpdate = true;
      }

      // lamp follows the rock under the pointer or keyboard focus
      var target = stage.hover >= 0 && stage.rocks[stage.hover] && !stage.rocks[stage.hover].broken ? 1 : 0;
      stage.hoverLevel += (target - stage.hoverLevel) * Math.min(1, dt * 10);
      if (target) {
        var hp = cell(stage.hover);
        hoverLight.position.lerp(new THREE.Vector3(hp.x, hp.y, 0.95), Math.min(1, dt * 14));
      }
      hoverLight.intensity = stage.hoverLevel * 2.6;

      stage.shake = Math.max(0, stage.shake - dt * 3.2);
      var sh = reducedMotion ? 0 : stage.shake * stage.shake * 0.05;
      var par = reducedMotion ? 0 : 0.09;
      camera.position.set(
        stage.home.x + stage.pointer.x * par + (Math.random() - 0.5) * sh,
        stage.home.y + stage.pointer.y * par + (Math.random() - 0.5) * sh,
        stage.home.z
      );
      camera.lookAt(0, 0, 0);
      res.renderer.render(scene, camera);
    }

    /* Public API ---------------------------------------------------------------- */

    stage.reset = function (count) {
      stage.count = count;
      stage.seed = Math.floor(Math.random() * 1000) + 1;
      stage.rocks = [];
      for (var i = 0; i < count; i++) stage.rocks.push({ hits: 0, broken: false, specimen: null, mesh: null });
      rebuild();
    };

    stage.strike = function (i, hits) {
      var rock = stage.rocks[i];
      if (!rock || rock.broken || !rock.mesh) return;
      rock.hits = hits;
      addCrack(rock, i, Math.min(hits, 2));
      burst(i, 3);
      stage.shake = 0.7;
      sound.strike();
      var mesh = rock.mesh, home = rock.home;
      var kick = (Math.random() - 0.5) * 0.12;
      stage.tweens.push({
        t: 0, dur: 0.22,
        update: function (k) {
          var punch = Math.sin(k * Math.PI);
          mesh.position.z = home.z - punch * 0.06;
          mesh.rotation.x = punch * kick;
          mesh.rotation.y = -punch * kick;
        },
      });
    };

    stage.breakOpen = function (i, specimen) {
      var rock = stage.rocks[i];
      if (!rock || rock.broken) return;
      rock.broken = true;
      rock.specimen = specimen || null;
      if (rock.mesh) {
        content.remove(rock.mesh);
        rock.mesh.traverse(function (o) {
          if (o.geometry) o.geometry.dispose();
        });
        rock.mesh = null;
      }
      burst(i, 14);
      stage.shake = 1;
      sound.crumble();
      if (specimen) sound.chime();
      fillPocket(rock, i, true);
    };

    stage.activate = function () {
      if (res.active && res.active !== stage) res.active.deactivate();
      res.active = stage;
      face.insertBefore(res.renderer.domElement, face.firstChild);
      resize();
      if (!stage.running) {
        stage.running = true;
        stage.last = performance.now();
        requestAnimationFrame(frame);
      }
    };

    stage.deactivate = function () {
      stage.running = false;
      if (res.active === stage) res.active = null;
    };

    face.addEventListener('pointermove', function (event) {
      var rect = face.getBoundingClientRect();
      stage.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      stage.pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    });
    function setHover(event) {
      var button = event.target.closest && event.target.closest('.mine__rock');
      stage.hover = button ? Array.prototype.indexOf.call(face.querySelectorAll('.mine__rock'), button) : -1;
    }
    face.addEventListener('pointerover', setHover);
    face.addEventListener('focusin', setHover);
    face.addEventListener('pointerleave', function () {
      stage.hover = -1;
      stage.pointer.x = stage.pointer.y = 0;
    });

    if (window.ResizeObserver) new ResizeObserver(resize).observe(face);
    var onLayout = function () {
      if (stage.count && (narrow.matches ? 3 : 4) !== stage.cols) rebuild();
    };
    if (narrow.addEventListener) narrow.addEventListener('change', onLayout);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stage.running = false;
      else if (res.active === stage && !stage.running) {
        stage.running = true;
        stage.last = performance.now();
        requestAnimationFrame(frame);
      }
    });

    return stage;
  }

  window.CrystalMine3D = { supported: supported, createStage: createStage, sound: sound };
})();
