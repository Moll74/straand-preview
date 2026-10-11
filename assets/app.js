/* Site behaviour: theme, menu, booking bar, season picker, CTA tracking, and the scroll choreography
 * (Lenis + GSAP ScrollTrigger). House rules: slow fades, no scale/grow-in, no sideways page scroll on phones. */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement, ST_ = window.ST || { lang: 'nb', book: {} };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lenis = null;
  const desk = matchMedia('(min-width: 821px)');

  /* CTA tracking (dataLayer, ready for GA4/GTM) */
  window.dataLayer = window.dataLayer || [];
  document.addEventListener('click', e => { const a = e.target.closest('[data-cta]'); if (a) dataLayer.push({ event: 'cta_click', cta_id: a.dataset.cta }); });

  /* theme */
  $('.theme')?.addEventListener('click', () => {
    const t = root.dataset.theme === 'dark' ? 'light' : 'dark'; root.dataset.theme = t;
    try { localStorage.setItem('st-theme', t); } catch (e) {}
  });

  /* mobile menu */
  const burger = $('.burger'), mnav = $('#mnav');
  const menu = open => { if (!burger) return; root.classList.toggle('menu-open', open); burger.setAttribute('aria-expanded', open); mnav.hidden = !open; document.body.style.overflow = open ? 'hidden' : ''; open ? lenis?.stop() : lenis?.start(); };
  burger?.addEventListener('click', () => menu(burger.getAttribute('aria-expanded') !== 'true'));
  mnav?.addEventListener('click', e => { if (e.target.closest('a')) menu(false); });

  /* header: fixed and always visible (Bigum: fixed menu); turns solid after the hero */
  const hdr = $('#hdr');
  const onScroll = () => { const hero = $('#hero'); hdr.classList.toggle('solid', !hero || scrollY > hero.offsetHeight - 90); };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* booking forms (hero bar + dialog on every page) -> SynXis with dates and guests */
  const iso = d => d.toISOString().slice(0, 10);
  $$('.bookform').forEach(bar => {
    const a = bar.arrive, d = bar.depart, t = new Date();
    a.min = iso(t); a.value = iso(t); t.setDate(t.getDate() + 1); d.min = iso(t); d.value = iso(t);
    a.addEventListener('change', () => { const n = new Date(a.value); n.setDate(n.getDate() + 1); d.min = iso(n); if (d.value <= a.value) d.value = iso(n); });
    bar.addEventListener('submit', e => {
      e.preventDefault();
      const b = ST_.book, q = new URLSearchParams({ Hotel: b.hotel, locale: ST_.lang === 'nb' ? 'nb-NO' : 'en-GB', arrive: a.value, depart: d.value, adult: bar.adult.value, child: bar.child.value });
      dataLayer.push({ event: 'begin_booking', arrive: a.value, nights: (new Date(d.value) - new Date(a.value)) / 864e5 });
      open(`${b.url}?${q}`, '_blank', 'noopener');
    });
  });

  /* dialogs: booking (from any "Book" link; on the homepage the hero bar is used instead) and search */
  const bookDlg = $('#bookDlg'), searchDlg = $('#searchDlg');
  const show = dlg => { dlg.showModal(); lenis?.stop(); };
  $$('.dlg').forEach(d => { d.addEventListener('close', () => lenis?.start()); d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); }); });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-open-book], a[href="#book"]');
    if (b) {
      e.preventDefault(); menu(false);
      const heroBar = $('.hero #book');
      if (heroBar && scrollY < innerHeight * .6) { heroBar.arrive.focus(); return; }
      show(bookDlg); bookDlg.querySelector('input').focus(); return;
    }
    if (e.target.closest('[data-open-search]')) { e.preventDefault(); menu(false); show(searchDlg); $('#searchIn').focus(); }
  });

  /* site search over window.SEARCH (pages, rooms, venues, seasons, events, FAQ, posts) */
  const fold = s => s.toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const sIn = $('#searchIn'), sR = $('#searchR'), sNone = $('.search-none');
  sIn?.addEventListener('input', () => {
    const q = fold(sIn.value).split(/\s+/).filter(w => w.length > 1);
    if (!q.length) { sR.innerHTML = ''; sNone.hidden = true; return; }
    const hits = (window.SEARCH || []).map(it => { const t = fold(it.t), x = fold(it.x); let s = 0;
      for (const w of q) { if (t.includes(w)) s += 3; else if (x.includes(w)) s += 1; else return null; } return [s, it]; })
      .filter(Boolean).sort((a, b) => b[0] - a[0]).slice(0, 8);
    sR.innerHTML = hits.map(([, it]) => `<li><a href="${it.u}"><small>${it.k}</small><b>${it.t}</b><span>${it.x.slice(0, 110)}${it.x.length > 110 ? '…' : ''}</span></a></li>`).join('');
    sNone.hidden = hits.length > 0;
    dataLayer.push({ event: 'search', q: sIn.value.slice(0, 60), hits: hits.length });
  });
  sR?.addEventListener('click', e => { if (e.target.closest('a')) searchDlg.close(); });

  /* dropdowns: hover on desktop (CSS), click/tap and keyboard everywhere; one open at a time */
  const dds = $$('.dd');
  // a dropdown sits under its own menu item, moved sideways only as far as it must to stay 16px inside the window
  const place = d => { const p = $('.dd-p', d); if (!p) return; p.style.setProperty('--dx', '0px');
    const r = p.getBoundingClientRect(), w = document.documentElement.clientWidth;
    const dx = r.left < 16 ? 16 - r.left : r.right > w - 16 ? (w - 16) - r.right : 0; p.style.setProperty('--dx', Math.round(dx) + 'px'); };
  dds.forEach(d => { d.addEventListener('mouseenter', () => place(d)); d.addEventListener('focusin', () => place(d)); $('.dd-b', d) && $('.dd-b', d).addEventListener('click', () => place(d)); });
  const closeAll = except => dds.forEach(d => { if (d !== except) { d.classList.remove('open'); $('.dd-b', d).setAttribute('aria-expanded', 'false'); } });
  dds.forEach(d => {
    const b = $('.dd-b', d);
    b.addEventListener('click', () => { const o = !d.classList.contains('open'); closeAll(d); d.classList.toggle('open', o); b.setAttribute('aria-expanded', o); });
    d.addEventListener('mouseenter', () => { if (matchMedia('(hover: hover)').matches) { closeAll(d); b.setAttribute('aria-expanded', 'true'); } });
    d.addEventListener('mouseleave', () => { if (matchMedia('(hover: hover)').matches && !d.classList.contains('open')) b.setAttribute('aria-expanded', 'false'); });
  });
  document.addEventListener('click', e => { if (!e.target.closest('.dd')) closeAll(); });
  document.addEventListener('keydown', e => { if (e.key !== 'Escape') return;           // Esc closes and hands focus back to the menu button
    const o = dds.find(d => d.classList.contains('open') || d.contains(document.activeElement)); closeAll(); if (o) $('.dd-b', o).focus(); });
  dds.forEach(d => d.addEventListener('focusout', e => { if (!d.contains(e.relatedTarget)) closeAll(); }));   // tabbing out closes it

  /* season picker: defaults to the current season, drives the 3D scene */
  /* the other seasons' hero photos carry data-src: fetched when picked, or after the page has loaded */
  const heroImg = f => { const im = $('img[data-src]', f); if (!im) return; im.srcset = im.dataset.srcset; im.src = im.dataset.src; im.removeAttribute('data-src'); im.removeAttribute('data-srcset'); };
  window.STHeroImgs = () => { const all = () => $$('.hero-photos figure').forEach(heroImg);   // as soon as the guest reaches for the picker, else a little later
    pick && ['pointerenter', 'focusin', 'touchstart'].forEach(ev => pick.addEventListener(ev, all, { once: true, passive: true })); setTimeout(all, 4000); };
  const pick = $('.seasons-pick');
  if (pick) {
    const m = new Date().getMonth(), now = m < 2 || m === 11 ? 'snow' : m < 5 ? 'petals' : m < 8 ? 'fireflies' : 'leaves';
    const set = fx => {
      $$('button', pick).forEach(b => b.setAttribute('aria-pressed', b.dataset.season === fx));
      $$('.hero-photos figure').forEach(f => { const on = f.dataset.fx === fx; f.classList.toggle('on', on); if (on) heroImg(f); });
      window.STFx?.setSeason(fx);
    };
    set(now);
    pick.addEventListener('click', e => { const b = e.target.closest('button'); if (b) set(b.dataset.season); });
  }

  /* the hotel's own film (YouTube, privacy-enhanced domain). Background: muted loop, injected only when the section is
     on screen, scaled past the film's letterbox bars. Click: plays with sound in a dialog (or inline on /motorsykkel/). */
  const YT = (id, bg) => `https://www.youtube-nocookie.com/embed/${id}?` + new URLSearchParams(bg
    ? { autoplay: 1, mute: 1, loop: 1, playlist: id, controls: 0, playsinline: 1, rel: 0, modestbranding: 1, disablekb: 1, iv_load_policy: 3 }
    : { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1 });
  const frame = (id, bg) => { const f = document.createElement('iframe'); f.src = YT(id, bg); f.title = 'Straand Hotel – film';
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.setAttribute('allowfullscreen', ''); if (bg) { f.tabIndex = -1; f.setAttribute('aria-hidden', 'true'); } return f; };
  const media = () => !!window.STConsent?.has('media');
  const mc = $('.mc');
  const startBg = () => {
    const box = $('.mc-video', mc), media = $('.mc-media', mc);
    const fit = () => { const f = $('iframe', box); if (!f) return;                      // active picture is 1280x464 inside 16:9
      const W = media.clientWidth, H = media.clientHeight, w = Math.max(W, H / .3625) * 1.02; f.style.width = w + 'px'; f.style.height = w * 9 / 16 + 'px'; };
    new IntersectionObserver((es, io) => { if (!es[0].isIntersecting) return; io.disconnect();
      box.append(frame(mc.dataset.yt, true)); fit(); setTimeout(() => mc.classList.add('playing'), 4200); }, { rootMargin: '200px' }).observe(mc);  // after YouTube's start-up overlay
    addEventListener('resize', fit);
  };
  let bgOn = false;
  const tryBg = () => { if (!bgOn && mc && media() && !reduce && !(navigator.connection && navigator.connection.saveData)) { bgOn = true; mc.classList.add('bg-on'); startBg(); } };
  tryBg();

  /* external media need consent: a click on "show" counts as consent for external media */
  const ask = (target, run) => { const nb = (ST_.lang || 'nb') === 'nb';
    target.replaceChildren(Object.assign(document.createElement('div'), { className: 'ext-ok', innerHTML:
      `<p>${nb ? 'Filmen vises fra YouTube eller Vimeo, som kan sette egne informasjonskapsler.' : 'The film is shown from YouTube or Vimeo, which may set their own cookies.'}</p>
       <button class="btn btn-gold" type="button">${nb ? 'Vis filmen' : 'Show the film'}</button>` }));
    target.querySelector('button').addEventListener('click', () => { window.STConsent?.grant('media'); run(); }); };
  const loadMaps = () => $$('.map[data-map]').forEach(m => { const f = document.createElement('iframe'); f.src = m.dataset.map; f.title = m.dataset.title; f.loading = 'lazy'; m.replaceChildren(f); m.removeAttribute('data-map'); });
  if (media()) loadMaps();
  document.addEventListener('st-consent', () => { if (media()) { loadMaps(); tryBg(); } });
  document.addEventListener('click', e => { const g = e.target.closest('[data-grant]'); if (g) window.STConsent?.grant(g.dataset.grant); });
  const vDlg = $('#videoDlg');
  document.addEventListener('click', e => {
    const vo = e.target.closest('[data-vimeo-open]');
    if (vo && vDlg) { const w = $('.vid-wrap', vDlg), play = () => { const f = document.createElement('iframe');
        f.src = `https://player.vimeo.com/video/${vo.dataset.vimeoOpen}?autoplay=1&dnt=1&title=0&byline=0`; f.allow = 'autoplay; fullscreen; picture-in-picture'; f.setAttribute('allowfullscreen', ''); f.title = 'Video'; w.replaceChildren(f); };
      const hd = $('.dlg-h b', vDlg); if (hd) { hd.dataset.def ??= hd.textContent; hd.textContent = vo.dataset.title || hd.dataset.def; }   // the film's own name
      media() ? play() : ask(w, play); vDlg.showModal(); window.__lenis?.stop(); return; }
    const o = e.target.closest('[data-yt-open]');
    if (o && vDlg) { const w = $('.vid-wrap', vDlg), play = () => w.replaceChildren(frame(o.dataset.ytOpen, false));
      media() ? play() : ask(w, play); vDlg.showModal(); window.__lenis?.stop(); dataLayer.push({ event: 'video_play', where: 'dialog' }); return; }
    const i = e.target.closest('[data-yt-inline]');
    if (i) { const fc = i.closest('.yt-facade'), play = () => {
        if (fc.dataset.vimeo) { const f = document.createElement('iframe'); f.src = `https://player.vimeo.com/video/${fc.dataset.vimeo}?autoplay=1&dnt=1&title=0&byline=0`; f.title = 'Video';
          f.allow = 'autoplay; fullscreen; picture-in-picture'; f.setAttribute('allowfullscreen', ''); fc.replaceChildren(f); }
        else fc.replaceChildren(frame(fc.dataset.yt, false));
        fc.classList.add('on'); };
      media() ? play() : ask(fc, play); dataLayer.push({ event: 'video_play', where: 'inline' }); }
  });
  vDlg?.addEventListener('close', () => $('.vid-wrap', vDlg).replaceChildren());

  /* long galleries: "Vis alle N bilder" opens the rest in place */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-pgal-more]'); if (!b) return;
    const g = b.parentElement.previousElementSibling; g.querySelectorAll('.pg[hidden]').forEach(x => { x.hidden = false; });
    b.parentElement.remove(); g.querySelectorAll('.pg')[8]?.focus();
  });

  /* photo galleries: a photo opens full size; arrows and swipe go through the gallery, Esc closes */
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-lightbox]'); if (!a) return; e.preventDefault();
    const all = [...a.closest('.pgal').querySelectorAll('[data-lightbox]')]; let i = all.indexOf(a);
    const d = document.createElement('dialog'), nb = (ST_.lang || 'nb') === 'nb'; d.className = 'lbox';
    d.setAttribute('aria-label', nb ? 'Bildevisning' : 'Photo viewer');
    d.innerHTML = `<button class="lb-x" type="button" aria-label="${nb ? 'Lukk' : 'Close'}">×</button><img alt=""><button class="lb-p" type="button" aria-label="${nb ? 'Forrige bilde' : 'Previous photo'}">‹</button><button class="lb-n" type="button" aria-label="${nb ? 'Neste bilde' : 'Next photo'}">›</button><p class="lb-c" aria-live="polite"></p>`;
    const im = d.querySelector('img'), cap = d.querySelector('.lb-c');
    const show = n => { i = (n + all.length) % all.length; const t = all[i].querySelector('img'); im.src = all[i].href; im.alt = t.alt; cap.textContent = t.alt; };
    d.querySelector('.lb-x').onclick = () => d.close(); d.querySelector('.lb-p').onclick = () => show(i - 1); d.querySelector('.lb-n').onclick = () => show(i + 1);
    d.addEventListener('keydown', k => { if (k.key === 'ArrowLeft') show(i - 1); if (k.key === 'ArrowRight') show(i + 1); });
    let x0 = null; d.addEventListener('touchstart', t => { x0 = t.touches[0].clientX; }, { passive: true });
    d.addEventListener('touchend', t => { if (x0 === null) return; const dx = t.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1)); x0 = null; });
    d.addEventListener('close', () => { d.remove(); window.__lenis?.start(); a.focus(); });   // focus goes back to the photo that opened it d.addEventListener('click', ev => { if (ev.target === d) d.close(); });
    document.body.append(d); show(i); d.showModal(); window.__lenis?.stop();
  });

  /* inquiry forms ("Be om tilbud"): check the required fields, then open a prefilled email to the hotel.
     At launch the same data posts to the chosen form service; the dataLayer event measures the conversion. */
  document.addEventListener('submit', e => {
    const f = e.target.closest('form[data-inquiry]'); if (!f) return; e.preventDefault();
    const nb = (document.documentElement.lang || 'nb').startsWith('nb'), ok = f.querySelector('.inq-ok');
    const bad = [...f.querySelectorAll('[required]')].filter(x => !x.value.trim() || (x.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.value)));
    f.querySelectorAll('[aria-invalid]').forEach(x => x.removeAttribute('aria-invalid')); bad.forEach(x => x.setAttribute('aria-invalid', 'true'));
    if (bad.length) {                          // name the fields that need attention (the status line is read out by screen readers)
      const names = bad.map(x => (f.querySelector(`label[for="${x.id}"] span`)?.firstChild?.textContent || x.name).trim().toLowerCase()).join(', ');
      ok.textContent = (nb ? 'Sjekk disse feltene: ' : 'Please check these fields: ') + names + '.'; bad[0].focus(); return; }
    const d = Object.fromEntries(new FormData(f).entries());
    const lines = Object.entries(d).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
    const subj = `${nb ? 'Forespørsel' : 'Enquiry'}: ${d.type || ''} ${d.date || ''}` + (d.people ? ` (${d.people} ${nb ? 'pers.' : 'people'})` : '');
    (window.dataLayer = window.dataLayer || []).push({ event: 'inquiry', kind: f.dataset.inquiry, type: d.type, people: d.people });
    location.href = `mailto:${f.dataset.to}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(lines)}`;
    ok.textContent = nb ? 'E-postprogrammet ditt åpnes med forespørselen ferdig utfylt. Send den derfra, eller ring oss.' : 'Your email app opens with the request filled in. Send it from there, or call us.';
  });

  /* dictation in message fields: tap the mic and speak (Web Speech API; Chrome, Edge, Safari). The words are written into
     the field, after anything already typed, so the guest can check and correct them before sending. Only shown where it works. */
  (() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return;
    const nb = (document.documentElement.lang || 'nb').startsWith('nb');
    document.querySelectorAll('form.inq textarea').forEach(ta => {
      const wrap = document.createElement('div'); wrap.className = 'dict'; ta.parentNode.insertBefore(wrap, ta); wrap.append(ta);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mic dict-mic'; b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-label', nb ? 'Snakk inn meldingen' : 'Speak your message'); b.title = nb ? 'Trykk og snakk' : 'Tap and talk';
      b.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`; wrap.append(b);
      const ph = nb ? 'Skriv meldingen her – eller trykk på mikrofonen og snakk den inn.' : 'Type your message here – or tap the microphone and speak it.';
      ta.placeholder = ph;
      const note = document.createElement('p'); note.className = 'dict-note';
      note.innerHTML = nb ? '<b>Snakk heller enn å skrive?</b> Trykk på den gule mikrofonen, si meldingen din og trykk igjen når du er ferdig. Du kan rette teksten før du sender. <small>Tale gjenkjennes av nettleseren din (i Chrome via Google).</small>'
                          : '<b>Rather talk than type?</b> Tap the yellow microphone, say your message and tap again when you are done. You can correct the text before sending. <small>Speech is recognised by your browser (in Chrome via Google).</small>';
      wrap.after(note);
      let rec = null, on = false;
      b.addEventListener('click', () => {
        if (on) { rec.stop(); return; }
        const base = ta.value.trim() ? ta.value.replace(/\s*$/, ' ') : '';
        rec = new SR(); rec.lang = nb ? 'nb-NO' : 'en-GB'; rec.interimResults = true; rec.continuous = true;
        rec.onresult = e => { let t = ''; for (const r of e.results) t += r[0].transcript; ta.value = base + t.trim(); };
        rec.onend = () => { on = false; b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); ta.placeholder = ph; };
        rec.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed')
          note.textContent = nb ? 'Mikrofonen er blokkert i nettleseren. Du kan tillate den i adressefeltet, eller skrive meldingen.' : 'The microphone is blocked in your browser. Allow it in the address bar, or type your message.'; };
        try { rec.start(); on = true; b.classList.add('on'); b.setAttribute('aria-pressed', 'true'); ta.placeholder = nb ? 'Jeg lytter … trykk igjen når du er ferdig' : 'Listening … tap again when you are done';
          (window.dataLayer = window.dataLayer || []).push({ event: 'form_dictation', kind: ta.form?.dataset.inquiry }); } catch (e) {}
      });
    });
  })();

  /* page tops: photos that fade into each other every 5 s; a film that stays still for visitors who prefer less motion */
  (() => {
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelectorAll('.sub-img.hero-vid video').forEach(v => { if (calm) { v.removeAttribute('autoplay'); v.pause(); } });
    if (calm) return;
    document.querySelectorAll('.sub-img.slides').forEach(f => {
      const im = [...f.querySelectorAll('img')]; if (im.length < 2) return; let i = 0;
      im.slice(1).forEach(x => { x.loading = 'eager'; });
      setInterval(() => { im[i].classList.remove('on'); i = (i + 1) % im.length; im[i].classList.add('on'); }, 5000);
    });
  })();

  /* open the host from any [data-open-host] */
  document.addEventListener('click', e => { if (e.target.closest('[data-open-host]')) window.STHost?.open(); });

  /* ---------------- motion ---------------- */
  /* GSAP, ScrollTrigger and Lenis load after the page (see the loader at the end): nothing here may delay the first
     screen. What is already on screen when they arrive is left as it is (no fade-out-and-back). */
  /* reveals (headings word by word, text and cards fade up, counters count): IntersectionObserver + CSS transitions,
     no per-element ScrollTriggers and no forced layout. Whatever is on screen (or above it) when this starts stays as it is. */
  window.STReveal = () => {
    if (reduce || !('IntersectionObserver' in window)) return;
    const els = $$('.split, .lead, .sec-h p, .room, .card, .qa, .event, .times li, .people li, .facts li, .fram-t > *, .count');
    const count = el => { const n = parseInt(el.dataset.to, 10), a = n > 1000 ? 1800 : 0, t0 = performance.now();
      const f = now => { const k = Math.min(1, (now - t0) / 2000); el.textContent = Math.round(a + (n - a) * (1 - (1 - k) * (1 - k))); if (k < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); };
    const io = new IntersectionObserver(es => es.forEach(e => {
      const el = e.target;
      if (!el.dataset.rv) {                              // first report: decide once, from the observer's own geometry
        el.dataset.rv = '1';
        if (e.boundingClientRect.top < innerHeight) { io.unobserve(el); return; }
        if (el.classList.contains('count')) { if (/^\d+$/.test(el.dataset.to)) el.textContent = parseInt(el.dataset.to, 10) > 1000 ? 1800 : 0; else io.unobserve(el); return; }
        if (el.classList.contains('split')) {
          let i = 0; el.innerHTML = el.innerHTML.split(/(<br>)/).map(part => part === '<br>' ? part : part.split(' ').map(w => w ? `<span class="w"><span style="--i:${i++}">${w}</span></span>` : '').join(' ')).join('');
        }
        el.classList.add('rv'); return;
      }
      if (e.isIntersecting) { io.unobserve(el); if (el.classList.contains('count')) return count(el);
        el.classList.add('in'); setTimeout(() => el.classList.remove('rv', 'in'), 1100 + 60 * (el.querySelectorAll('.w').length + 1)); }   // then back to its own styles (hover etc.)
    }), { rootMargin: '0px 0px -12% 0px' });
    els.forEach(el => io.observe(el));
  };

  window.STMotion = () => {
  if (reduce || !window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  /* the set-up runs in small slices so it never blocks the main thread for long (phones) */
  const Q = [], T = f => Q.push(f);
  if (window.Lenis) {
    lenis = window.__lenis = new Lenis({ lerp: .09, smoothWheel: true, prevent: n => !!n.closest('.host, .mnav') });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]'); if (!a || a.getAttribute('href').length < 2) return;
      const t = document.querySelector(a.getAttribute('href')); if (!t) return;
      e.preventDefault(); lenis.scrollTo(t, { offset: -70, duration: 1.4 });
    });
  }


  /* hero: intro, then text drifts up and fades as the camera glides over the lake */
  const heroIn = $('.hero-in');
  if (heroIn) T(() => {
    gsap.to(heroIn, { yPercent: -18, opacity: 0, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom 35%', scrub: true } });
    gsap.to('.hero-photos img', { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } });
  });

  /* aerial photo opens from a frame */
  if ($('.reveal-img')) T(() => gsap.to('.reveal-img', { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none', scrollTrigger: { trigger: '.reveal', start: 'top 80%', end: 'bottom 70%', scrub: true } }));

  /* slow parallax inside framed images */
  $$('img.par').forEach(img => T(() => gsap.fromTo(img, { yPercent: -7 }, { yPercent: 7, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } })));

  /* eat & drink: active venue swaps the sticky image */
  const venues = $('.venues');
  if (venues) T(() => {
    venues.classList.add('is-live');
    $$('.venue', venues).forEach(v => ScrollTrigger.create({ trigger: v, start: 'top 55%', end: 'bottom 55%', onToggle: s => {
      if (!s.isActive) return; $$('.venue', venues).forEach(x => x.classList.toggle('on', x === v));
      $$('.vs-f').forEach(f => f.classList.toggle('on', f.dataset.i === v.dataset.i)); } }));
    $('.venue', venues).classList.add('on');
  });

  T(() => ScrollTrigger.matchMedia({
    '(min-width: 821px)': () => {
      /* seasons: pinned, each season fades over the last */
      const ss = $$('.season');
      if (ss.length) {
        const tl = gsap.timeline({ scrollTrigger: { trigger: '.seasons', start: 'top top', end: () => '+=' + innerHeight * (ss.length - .3), pin: true, scrub: .6 } });
        ss.slice(1).forEach((s, i) => {
          tl.to($('.season-t', ss[i]), { opacity: 0, y: -30, duration: .45, ease: 'power1.in' }, i + .3)
            .to(s, { opacity: 1, duration: 1, ease: 'none' }, i + .3)
            .from($('.season-t', s), { y: 40, duration: 1, ease: 'power2.out' }, i + .3)
            .to($('.season-img img', ss[i]), { yPercent: -4, duration: 1, ease: 'none' }, i + .3);
        });
      }
      /* history: the timeline glides sideways inside its own frame (never the page) */
      const track = $('.history .tl:not(.tl-v)');            // home page only; the history page lists the years vertically
      if (track) gsap.to(track, { x: () => -(track.scrollWidth - innerWidth + 40), ease: 'none',
        scrollTrigger: { trigger: '.history', start: 'top 8%', end: () => '+=' + (track.scrollWidth - innerWidth + 40), pin: true, scrub: .6, invalidateOnRefresh: true } });
    }
  }));

  const step = () => { const t0 = performance.now(); while (Q.length && performance.now() - t0 < 25) Q.shift()();
    if (Q.length) return setTimeout(step, 0);
    ScrollTrigger.refresh();
    /* phones lay out far sections only when they come near (content-visibility): keep trigger positions true */
    let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => ScrollTrigger.refresh(), 250); }).observe($('main') || document.body); };
  step();
  };
})();

/* FAQ deep links (#booking-3 from search or the AI concierge): open the question that is linked to */
(() => {
  const openHash = () => { const d = location.hash && document.getElementById(location.hash.slice(1)); if (d && d.tagName === 'DETAILS') { d.open = true; d.scrollIntoView({ block: 'center' }); } };
  addEventListener('hashchange', openHash); if (document.readyState === 'loading') addEventListener('DOMContentLoaded', openHash); else openHash();
})();

/* parking / getting-here map: Leaflet + OpenStreetMap tiles, only after consent for external media */
(() => {
  /* sights filter */
  document.querySelectorAll('.sights-s .chips').forEach(g => g.addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return;
    g.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b));
    document.querySelectorAll('.sight').forEach(s => { s.hidden = !!b.dataset.cat && s.dataset.cat !== b.dataset.cat; }); }));
  const box = document.querySelector('.pmap[data-points]'); if (!box) return;
  const load = (src, css) => new Promise(r => { const e = document.createElement(css ? 'link' : 'script'); if (css) { e.rel = 'stylesheet'; e.href = src; } else e.src = src; e.onload = r; document.head.append(e); });
  let done = false;
  const draw = async () => {
    if (done || !window.STConsent?.has('media')) return; done = true;
    await load('/straand-preview/assets/vendor/leaflet/leaflet.css', true); await load('/straand-preview/assets/vendor/leaflet/leaflet.js');
    const pts = JSON.parse(box.dataset.points); box.replaceChildren(); box.classList.add('on');
    const map = L.map(box, { scrollWheelZoom: false, attributionControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    const sym = { H: 'S', P: 'P', EV: '⚡', BUS: '🚌', S: '★' };
    const ms = pts.map(p => L.marker([p.lat, p.lon], { title: p.name, icon: L.divIcon({ className: 'pm pm-' + p.kind.toLowerCase(), html: `<span>${sym[p.kind]}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] }) })
      .addTo(map).bindPopup(`<b>${p.name}</b><br>${p.text}<br><a href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}" target="_blank" rel="noopener">${(window.ST?.lang || 'nb') === 'nb' ? 'Veibeskrivelse' : 'Directions'} ↗</a>`));
    map.fitBounds(L.featureGroup(ms).getBounds().pad(.35));
    document.querySelectorAll('.pcard').forEach(c => c.addEventListener('mouseenter', () => { const i = pts.findIndex(p => p.id === c.id); if (i > -1) ms[i].openPopup(); }));
  };
  draw(); document.addEventListener('st-consent', draw);
})();

/* speed: what the first screen does not need loads after the page has loaded, when the browser is idle:
   the AI host and its knowledge, the search index, the scroll choreography (GSAP + ScrollTrigger + Lenis, skipped
   with prefers-reduced-motion), the other seasons' hero photos and background films (started near the screen). */
(() => {
  const v = (window.ST && ST.v) || '', L = (window.ST && ST.lang) || 'nb', got = {};
  const need = src => got[src] || (got[src] = new Promise((ok, no) => { const s = document.createElement('script'); s.src = src + '?v=' + v; s.async = false; s.onload = ok; s.onerror = no; document.body.append(s); }));
  window.STNeed = need;
  document.addEventListener('click', e => {
    if (e.target.closest('[data-open-search]')) need(`/straand-preview/assets/search-${L}.js`).then(() => { const i = document.getElementById('searchIn'); if (i && i.value) i.dispatchEvent(new Event('input')); });
    if (!window.STHost && e.target.closest('#hostBtn, [data-open-host]')) Promise.all([need(`/straand-preview/assets/kb-${L}.js`), need('/straand-preview/assets/host.js')]).then(() => window.STHost?.open());
  }, true);
  const films = () => {
    const vs = [...document.querySelectorAll('video[data-src]')]; if (!vs.length) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || (navigator.connection && navigator.connection.saveData)) return;   // the poster stays
    const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; const vd = e.target; io.unobserve(vd);
      vd.src = vd.dataset.src; vd.removeAttribute('data-src'); vd.autoplay = true; vd.play().catch(() => {}); }), { threshold: .25 });
    vs.forEach(vd => io.observe(vd));
  };
  const later = () => {
    need(`/straand-preview/assets/kb-${L}.js`); need(`/straand-preview/assets/search-${L}.js`); need('/straand-preview/assets/host.js');
    window.STHeroImgs?.();
    if (window.ST && ST.fx) need('/straand-preview/assets/fx.js');     // hero snow / leaves
    films();
    window.STReveal?.();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
      Promise.all(['/straand-preview/assets/vendor/gsap.min.js', '/straand-preview/assets/vendor/ScrollTrigger.min.js', '/straand-preview/assets/vendor/lenis.min.js'].map(need)).then(() => window.STMotion?.()).catch(() => {});
  };
  if (window.ST_after) ST_after(later); else addEventListener('load', later);
})();
