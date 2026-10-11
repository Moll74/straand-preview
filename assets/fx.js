/* Hero motion over the real photos: photographic snow (winter) and falling birch and aspen leaves (autumn); spring and summer
 * have no particles (summer gets a sun glow in CSS) and a gentle pointer depth shift of the photo. No WebGL, a few KB.
 * Speed: starts after the page has loaded and the browser is idle (never competes with the first screen); sprites are
 * drawn only for the season on show; phones and low-end devices get fewer particles at a lower resolution;
 * with prefers-reduced-motion a single still frame is drawn (the snow or leaves are there, nothing moves). */
(() => {
  const go = () => {
  const cv = document.getElementById('fx'), hero = document.getElementById('hero');
  if (!cv || !hero) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = matchMedia('(max-width: 820px)').matches, nav = navigator;
  const low = small || (nav.hardwareConcurrency || 8) <= 4 || (nav.deviceMemory || 8) <= 4 || !!(nav.connection && nav.connection.saveData);
  const ctx = cv.getContext('2d'), dpr = Math.min(devicePixelRatio || 1, low ? 1.5 : 2), K = low ? (small ? .55 : .7) : 1;
  let W = 0, H = 0, mode = 'leaves', alpha = 1, target = 1, next = null, P = [];
  const STYLE = {
    snow:      { n: Math.round((small ? 260 : 620) * K), size: [1, 2], vy: [30, 45], sway: 16, col: () => 0 },
    petals:    { n: 0, size: [1, 1], vy: [0, 0], sway: 0, col: () => 0 },
    fireflies: { n: 0, size: [1, 1], vy: [0, 0], sway: 0, col: () => 0 },
    leaves:    { n: Math.round((small ? 16 : 34) * (low ? .8 : 1)),   size: [7, 11],    vy: [30, 60],  sway: 70, col: () => Math.random() * LEAF.length | 0 },
  };
  const R = (a, b) => a + Math.random() * (b - a);

  /* autumn leaves as they fall around Vrådal: birch (small, oval, yellow) and aspen (round, orange
     to red). Each sprite is drawn once at load: a real leaf outline with teeth, mottled autumn colour, browned edges, midrib and
     side veins, a fold shadow and a stem; the underside is paler. A tiny copy drawn large gives the out-of-focus near leaves. */
  const KINDS = [
    { k: 'birch', w: 3, pal: ['#e8b62c', '#f0c94a', '#d99c1b', '#c98a16'], spot: ['#8a5a12', '#b0701a', '#9fae3a'] },
    { k: 'birch', w: 2, pal: ['#e3a524', '#f2c443', '#cf8a1a', '#b9771a'], spot: ['#7a4a10', '#a3651a'] },
    { k: 'aspen', w: 2, pal: ['#d9731f', '#e89a33', '#c5521b', '#b8401a'], spot: ['#6e2a0e', '#e6b544', '#8a3a12'] },
    { k: 'aspen', w: 1, pal: ['#c4471b', '#d9632a', '#a93516', '#e08a2e'], spot: ['#5e200c', '#d9a23a'] },
  ];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
  const rgba = (c, a, k = 1) => `rgba(${Math.min(255, c[0] * k | 0)},${Math.min(255, c[1] * k | 0)},${Math.min(255, c[2] * k | 0)},${a})`;
  function outline(kind, sc) {                       // points from the stem (y = +sc/2) to the tip (y = -sc/2), both edges
    const L = [], R_ = [], N = 80, asym = rnd(.92, 1.08);
    for (let i = 0; i <= N; i++) {
      const t = i / N; let w;
      if (kind === 'birch') {                          // ovate-triangular, pointed tip, doubly serrated
        w = .40 * Math.pow(Math.sin(Math.PI * Math.pow(t, .7)), .85) * (1 - .25 * t);
        w += w > .02 ? .022 * ((t * 15) % 1) + .01 * ((t * 30) % 1) : 0;
      } else if (kind === 'aspen') {                   // nearly round, short point, rounded teeth
        w = .5 * Math.sqrt(Math.max(0, 1 - Math.pow(2 * Math.pow(t, .85) - 1, 2))) * (1 - .12 * t);
        w += w > .03 ? .018 * Math.abs(Math.sin(t * Math.PI * 10)) : 0;
      }
      const y = (.5 - t) * sc;
      L.push([-w * sc, y]); R_.push([w * sc * asym, y]);
    }
    return L.concat(R_.reverse());
  }
  function leafSprite(K, px, back) {
    const c = document.createElement('canvas'); c.width = c.height = px; const g = c.getContext('2d'), sc = px * .82;
    g.translate(px / 2, px / 2); g.rotate(rnd(-.15, .15));
    const pts = outline(K.k, sc);
    g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath();
    const base = hex(K.pal[0]), k = back ? 1.12 : 1, a0 = back ? .9 : 1;
    const gr = g.createLinearGradient(0, sc / 2, 0, -sc / 2);
    gr.addColorStop(0, rgba(hex(K.pal[2]), a0, k)); gr.addColorStop(.5, rgba(base, a0, k)); gr.addColorStop(1, rgba(hex(K.pal[1]), a0, k));
    g.fillStyle = gr; g.fill(); g.save(); g.clip();
    for (let i = 0; i < 26; i++) {                   // mottled colour and spots, like a real autumn leaf
      const big = i < 16, col = hex(big ? K.pal[1 + (Math.random() * 3 | 0)] : K.spot[Math.random() * K.spot.length | 0]);
      const x = rnd(-.35, .35) * sc, y = rnd(-.45, .45) * sc, r = (big ? rnd(.12, .3) : rnd(.015, .05)) * sc;
      const sg = g.createRadialGradient(x, y, 0, x, y, r); sg.addColorStop(0, rgba(col, big ? .45 : .7)); sg.addColorStop(1, rgba(col, 0));
      g.fillStyle = sg; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.lineJoin = 'round'; g.strokeStyle = rgba(hex(K.spot[0]), back ? .35 : .55); g.lineWidth = sc * .07; g.filter = 'blur(' + (px / 60) + 'px)'; g.stroke(); g.filter = 'none';   // browned edge
    const vein = back ? 'rgba(255,236,190,.32)' : rgba(hex(K.pal[1]), .34, 1.12), vw = Math.max(.5, px / 140);
    g.strokeStyle = vein; g.lineCap = 'round';
    {
      g.lineWidth = vw * 1.6; g.beginPath(); g.moveTo(0, sc * .5); g.quadraticCurveTo(sc * .03, 0, 0, -sc * .48); g.stroke();
      g.lineWidth = vw;
      for (let i = 1; i < 8; i++) { if (Math.random() < .25) continue; const y = sc * (.42 - i * .11) + rnd(-.015, .015) * sc, l = sc * (K.k === 'aspen' ? .36 : .3) * Math.sin(Math.PI * (i / 8.5));
        for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(0, y); g.quadraticCurveTo(sd * l * .5, y - sc * .03, sd * l, y - sc * .12); g.stroke(); } }
    }
    const fold = g.createLinearGradient(-sc * .5, 0, sc * .5, 0);   // the leaf is bent along the midrib: one half in shade
    fold.addColorStop(0, 'rgba(255,240,210,.18)'); fold.addColorStop(.48, 'rgba(255,240,210,0)'); fold.addColorStop(.52, 'rgba(40,15,0,.14)'); fold.addColorStop(1, 'rgba(40,15,0,.26)');
    g.fillStyle = fold; g.fillRect(-px, -px, px * 2, px * 2);
    g.restore();
    const id = g.getImageData(0, 0, px, px), d = id.data;            // fine grain of the leaf surface
    for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { const n = (Math.random() - .5) * 18; d[i] += n; d[i + 1] += n; d[i + 2] += n * .6; }
    g.putImageData(id, 0, 0);
    g.strokeStyle = rgba(hex(K.spot[0]), .9); g.lineWidth = Math.max(1, px / 70); g.lineCap = 'round';   // stem
    g.beginPath(); g.moveTo(0, sc * .48); g.quadraticCurveTo(sc * .04, sc * .56, -sc * .02, sc * .6); g.stroke();
    return c;
  }
  const LEAF = []; KINDS.forEach((K, i) => { for (let j = 0; j < K.w; j++) LEAF.push(i); });
  /* snow: soft round flakes like a photo at a slow shutter. Far = tiny and crisp, near = large, out of focus, faint. */
  function flake(px, soft) {
    const c = document.createElement('canvas'); c.width = c.height = px; const g = c.getContext('2d'), m = px / 2;
    const gr = g.createRadialGradient(m, m, 0, m, m, m);
    if (soft) { gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(.55, 'rgba(255,255,255,.38)'); gr.addColorStop(.85, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); }
    else { gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(250,252,255,.92)'); gr.addColorStop(.7, 'rgba(240,246,255,.35)'); gr.addColorStop(1, 'rgba(240,246,255,0)'); }
    g.fillStyle = gr; g.fillRect(0, 0, px, px); return c;
  }
  /* sprites are made on first use, for the season on show only */
  let FLAKE = null; const flakes = () => FLAKE || (FLAKE = { sharp: flake(32, false), soft: flake(64, true) });
  const LPX = low ? 96 : 160, SPR = [];
  const lo = src => { const c = document.createElement('canvas'); c.width = c.height = 26; c.getContext('2d').drawImage(src, 0, 0, 26, 26); return c; };
  /* real leaves cut from the site's own autumn photo (data-leaves on the canvas): same tree as in the picture */
  const PHOTO = (cv.dataset.leaves || '').split(',').filter(Boolean).map(u => { const im = new Image(); im.src = u; return im; });
  const fromPhoto = i => { const im = PHOTO[i % PHOTO.length]; if (!im.complete || !im.naturalWidth) return null;
    const box = (src, px, f) => { const c = document.createElement('canvas'), k = px / Math.max(src.naturalWidth || src.width, src.naturalHeight || src.height);
      c.width = c.height = px; const g = c.getContext('2d'); if (f) g.filter = f;
      const w = (src.naturalWidth || src.width) * k, h = (src.naturalHeight || src.height) * k; g.drawImage(src, (px - w) / 2, (px - h) / 2, w, h); return c; };
    const f = box(im, LPX, ''), b = box(im, LPX, 'brightness(.72) saturate(.85)');
    return { k: 'photo', f, b, soft: box(im, 26, ''), softB: box(im, 26, 'brightness(.72)') }; };
  const SPP = []; const spr = i => PHOTO.length ? (SPP[i] || (SPP[i] = fromPhoto(i)) || spr0(i)) : spr0(i);
  const spr0 = i => SPR[i] || (SPR[i] = (() => { const K = KINDS[LEAF[i]], f = leafSprite(K, LPX, false), b = leafSprite(K, LPX, true); return { k: K.k, f, b, soft: lo(f), softB: lo(b) }; })());
  function spawn(top) {
    const s = STYLE[mode];
    const p = { x: Math.random() * W, y: top ? R(-H * .2, 0) : Math.random() * H, r: R(...s.size), vy: R(...s.vy), ph: Math.random() * 6.28,
             rot: Math.random() * 6.28, vr: R(-1.4, 1.4), c: s.col(), tw: Math.random() * 6.28, vx: 0, flip: Math.random() * 6.28, vf: R(1.2, 3.2), z: 1 };
    if (mode === 'snow') {                         // depth of field: 70% far, 22% mid, 8% near and blurred
      const d = Math.random(); p.z = d < .62 ? 0 : d < .9 ? 1 : 2;
      p.r = p.z === 0 ? R(1.6, 3) : p.z === 1 ? R(3.6, 6.4) : R(16, 34);
      p.vy = p.z === 0 ? R(28, 42) : p.z === 1 ? R(50, 75) : R(100, 150);
      p.vx = R(6, 16) * (p.z + 1); p.a = p.z === 0 ? R(.75, 1) : p.z === 1 ? R(.85, 1) : R(.35, .55);
    }
    if (mode === 'leaves') {                       // depth: far = small and sharp, near = big, soft and fast; they come from the tree on the left
      const d = Math.random(); p.z = d < .62 ? 0 : d < .9 ? 1 : 2;
      p.r = p.z === 0 ? R(9, 15) : p.z === 1 ? R(18, 28) : R(48, 74);
      p.vf2 = R(.6, 1.8); p.flip2 = Math.random() * 6.28;
      p.vy = (p.z === 0 ? R(22, 34) : p.z === 1 ? R(36, 52) : R(70, 95));
      p.vx = R(8, 26) * (p.z + 1) * .6; p.x = Math.random() * W * (top ? .55 : 1); p.vr = R(-.9, .9);
    }
    return p;
  }
  function fill() { P = Array.from({ length: STYLE[mode].n }, () => spawn(false)); }
  function size() { W = hero.clientWidth; H = hero.clientHeight; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  size(); fill(); addEventListener('resize', size);

  window.STFx = { setSeason(m) { if (m !== mode && STYLE[m]) { next = m; target = 0; } } };

  /* pointer depth: the photo shifts a few pixels against the pointer */
  const photos = hero.querySelector('.hero-photos'); let mx = 0, my = 0, px = 0, py = 0;
  if (!small) hero.addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });

  let visible = true, last = performance.now();
  if (!still) new IntersectionObserver(e => { visible = e[0].isIntersecting; if (visible) { last = performance.now(); requestAnimationFrame(loop); } }).observe(hero);
  function loop(now) {
    if (!visible || document.hidden) return;
    const dt = Math.min(.05, (now - last) / 1000), t = now / 1000; last = now;
    alpha += (target - alpha) * Math.min(1, dt * 2.5);
    if (next && alpha < .03) { mode = next; next = null; fill(); target = 1; }
    const dx = (mx - px) * .05, dy = (my - py) * .05; px += dx; py += dy;
    if (photos && !small && (Math.abs(dx) + Math.abs(dy) > .0004)) photos.style.transform = `translate3d(${(-px * 18).toFixed(2)}px, ${(-py * 12).toFixed(2)}px, 0)`;
    ctx.clearRect(0, 0, W, H); ctx.globalAlpha = alpha;
    const s = STYLE[mode];
    if (mode === 'leaves' || mode === 'snow') P.sort((a, b) => a.z - b.z);
    for (const p of P) {
      p.y += p.vy * dt; p.x += Math.sin(t * .8 + p.ph) * s.sway * dt; p.rot += p.vr * dt;
      if (mode === 'fireflies') { p.y += Math.cos(t * .6 + p.ph) * 8 * dt; }
      if (p.y > H + 80 || p.x < -80 || p.x > W + 80 || p.y < -H * .3) Object.assign(p, spawn(true), mode === 'fireflies' ? { y: Math.random() * H } : {});
      ctx.fillStyle = p.c;
      if (mode === 'snow') {
        p.x += (p.vx + Math.sin(t * .35) * 14) * dt;                       // light wind with slow gusts
        ctx.globalAlpha = alpha * p.a;
        const F = flakes(), img = p.z === 2 ? F.soft : F.sharp, d = p.r * 2;
        ctx.drawImage(img, p.x - p.r, p.y - p.r, d, d);
      } else if (mode === 'leaves') {
        p.x += p.vx * dt + Math.cos(t * .8 + p.ph) * s.sway * .4 * dt; p.flip += p.vf * dt; p.flip2 += p.vf2 * dt;
        const fx = Math.cos(p.flip), sp = spr(p.c), img = p.z === 2 ? (fx < 0 ? sp.softB : sp.soft) : (fx < 0 ? sp.b : sp.f);
        ctx.globalAlpha = alpha * (p.z === 2 ? .82 : p.z === 1 ? .95 : .88);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot + Math.sin(t * 1.3 + p.ph) * .35); ctx.scale(.2 + .8 * Math.abs(fx), .55 + .45 * Math.abs(Math.cos(p.flip2)));   // tumbling about two axes
        ctx.drawImage(img, -p.r, -p.r, p.r * 2, p.r * 2); ctx.restore();
      } else {
        ctx.globalAlpha = alpha * .9; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, .55 + .45 * Math.sin(t * 2 + p.ph));
        ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * .7, 0, 0, 6.283); ctx.fill(); ctx.restore();
      }
    }
    if (!still) requestAnimationFrame(loop);
  }
  const pre = document.querySelector('.seasons-pick [aria-pressed="true"]'); if (pre && STYLE[pre.dataset.season]) { mode = pre.dataset.season; fill(); }
  if (still) {                                     // one frame, redrawn only when the season changes
    const draw = () => { alpha = target = 1; loop(last = performance.now()); };
    window.STFx = { setSeason(m) { if (STYLE[m]) { mode = m; next = null; fill(); draw(); } } };
    draw(); addEventListener('resize', draw);
    return;
  }
  requestAnimationFrame(loop);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible) { last = performance.now(); requestAnimationFrame(loop); } });
  };
  const idle = window.requestIdleCallback || (f => setTimeout(f, 300));
  if (document.readyState === 'complete') idle(go); else addEventListener('load', () => idle(go));
})();
