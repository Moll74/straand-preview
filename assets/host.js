/* The on-page AI host. Answers from window.KB (built from site.json: every FAQ, room, venue, season, event,
 * time and contact on the site), in Norwegian or English, with action buttons. Never guesses: below the
 * confidence threshold it hands over to reception.
 * Mockup: matching runs in the browser. Production: answer() becomes a call to an LLM through SpiderGate with
 * the same KB as grounding context and the same "don't guess, hand over" rule. */
(() => {
  const btn = document.getElementById('hostBtn'), box = document.getElementById('concierge');
  if (!btn || !box) return;
  const log = document.getElementById('hostLog'), form = document.getElementById('hostForm'), input = document.getElementById('hostIn');
  const nb = (window.ST?.lang || 'nb') === 'nb';
  const K = () => window.KB || { items: [], times: {} };

  const open = () => { box.hidden = false; btn.classList.add('away'); document.getElementById('hostMicQuick')?.classList.add('away'); btn.setAttribute('aria-expanded', 'true'); setTimeout(() => input.focus(), 60); };
  const close = () => { try { speechSynthesis.cancel(); } catch (e) {} box.hidden = true; btn.classList.remove('away'); document.getElementById('hostMicQuick')?.classList.remove('away'); btn.setAttribute('aria-expanded', 'false'); btn.focus(); };
  btn.addEventListener('click', open);
  box.querySelector('.host-x').addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) close(); });
  window.STHost = { open };

  /* attract attention without nagging: a gentle bob + glow until first use, then example questions in a bubble.
     Stops for the rest of the visit once the guest opens the concierge or closes the bubble. */
  const tease = document.getElementById('tease'), reduceM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ss = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, sset = k => { try { sessionStorage.setItem(k, '1'); } catch (e) {} };
  let quiet = !!ss('st-concierge-quiet') || matchMedia('(max-width: 820px)').matches, tq = 0, timer = null;   // phones: no pop-up bubble, the concierge sits in the bottom bar
  const hush = () => { quiet = true; sset('st-concierge-quiet'); btn.classList.remove('nudge'); tease.hidden = true; tease.classList.remove('on'); clearInterval(timer); };
  if (!quiet) {
    if (!reduceM) btn.classList.add('nudge');
    const qs = JSON.parse(tease.dataset.q || '[]'), qb = tease.querySelector('.tease-q');
    const next = () => { if (quiet || document.hidden || !box.hidden) return;
      tease.classList.remove('on'); setTimeout(() => { qb.textContent = '«' + qs[tq++ % qs.length] + '»'; tease.hidden = false; requestAnimationFrame(() => tease.classList.add('on')); }, 350); };
    setTimeout(() => { if (quiet) return; next(); timer = setInterval(next, 6500); }, 4500);
    qb.addEventListener('click', () => { const q = qb.textContent.replace(/[«»]/g, ''); hush(); open(); setTimeout(() => ask(q), 150); window.dataLayer?.push({ event: 'concierge_teaser_click', q }); });
    tease.querySelector('.tease-x').addEventListener('click', hush);
  }
  btn.addEventListener('click', hush);
  document.addEventListener('click', e => { if (e.target.closest('[data-open-host]')) hush(); });

  /* ---------- text helpers ---------- */
  const fold = s => s.toLowerCase().replace(/[æ]/g, 'ae').replace(/[ø]/g, 'o').replace(/[å]/g, 'a').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const STOP = new Set(('hva hvor hvordan hvilke hvilken nar kan jeg vi dere du de er det den en et og i pa for med til av om har ha som at a fra ved man meg oss deres ' +
    'the a an is are do does can i we you to of in on at for with and or what when where how which there your my our be it this that have has').split(' '));
  const SYN = [
    [/basseng|svomm|pool|swim|bad(e|stu)|sauna/, 'basseng pool badstue sauna'],
    [/sjekke? ?inn|innsjekk|check.?in|ankomst|arriv/, 'innsjekk check-in'],
    [/sjekke? ?ut|utsjekk|check.?out|avreise|depart/, 'utsjekk check-out'],
    [/frokost|breakfast/, 'frokost breakfast'], [/middag|dinner|kveldsmat|supper/, 'middag dinner'], [/lunsj|lunch/, 'lunsj lunch'],
    [/mat|spise|restaurant|food|eat|meny|menu/, 'restauranten restaurant middag dinner'],
    [/bar|drink|cocktail|ol\b|vin\b|wine|beer/, 'fram bar vinkjelleren'],
    [/barn|famil|kids|child|lek/, 'familierom barnefamilier families children lekerom'],
    [/rullestol|handicap|tilgjengelig|accessib|wheelchair/, 'tilgjengelige accessible'],
    [/avbestill|cancel|endre|refund|no.?show/, 'avbestiller cancel'],
    [/konferanse|kurs|mote|meeting|conference|firma|teambuild/, 'konferanse conference vradalsalen'],
    [/bryllup|wedding|vielse|jubileum|konfirmasjon/, 'bryllup wedding'],
    [/hund|\bdogs?\b|\bpets?\b|dyr\b|katt|\bcats?\b/, 'hund dyr dog pets'],
    [/parker|parking/, 'parkering parking'],
    [/betal|pay|vipps|kort\b|card/, 'betalingsmater payment'],
    [/bat|fram|boat|sluse|lock|cruise/, 'ms fram'],
    [/kano|kajakk|sykkel|elsykkel|canoe|kayak|bike|sup|leie|hire|rent/, 'kano kajakk sykkel hire'],
    [/motorsykkel|mc\b|motorcycle|biker|hubriding|bil\b|car\b/, 'motorsykkelvennlig motorcycle bikers'],
    [/jul|christmas/, 'julebord christmas parties'], [/festival|dans|dance|musikk|music/, 'straandfestivalen festival'],
    [/historie|history|1864|gammel|old|generasjon/, 'historie history 1864'],
    [/vinter|winter|ski|alpin/, 'vinter winter'], [/sommer|summer|strand|beach/, 'sommer summer strandbaren'],
    [/host|autumn|fall\b/, 'host autumn'], [/var\b|spring|golf/, 'var spring golf'],
  ];
  const tokens = s => { let f = fold(s); SYN.forEach(([re, add]) => { if (re.test(f)) f += ' ' + add; });
    return f.split(/[^a-z0-9]+/).filter(w => w.length > 1 && !STOP.has(w)); };

  /* ---------- actions ---------- */
  const home = nb ? '/straand-preview/' : '/straand-preview/en/', LK = (K().links || {});
  const ACT = {
    book: [nb ? 'Se ledige rom' : 'See available rooms', '#book', 'p'],
    call: [(nb ? 'Ring ' : 'Call ') + (K().phone || ''), 'tel:' + (K().tel || '')],
    mail: [nb ? 'Send e-post' : 'Send email', 'mailto:' + (K().email || '')],
    map: [nb ? 'Veibeskrivelse' : 'Directions', K().maps || '#'],
    faq: [nb ? 'Alle spørsmål' : 'All questions', LK.faq || '/faq/'],
    events: [nb ? 'Se arrangementer' : 'See events', LK.events || home],
    eat: [nb ? 'Spis & drikk' : 'Eat & drink', LK.spis || home],
    rooms: [nb ? 'Se rommene' : 'See the rooms', LK.rom || home],
    parkmap: [nb ? 'Se kart og parkering' : 'Map & parking', (LK.finnfram || home), 'p'],
    meet: [nb ? 'Kurs og konferanser' : 'Meetings', LK.konferanse || home],
  };

  /* ---------- answer ---------- */
  function answer(q) {
    const k = K(), t = k.times || {}, f = fold(q);
    if (/^(hei|hallo|god (dag|morgen|kveld)|hi|hello|hey)\b/.test(f) && f.length < 20)
      return [nb ? 'Hei og velkommen! Spør meg om rom, mat, tider, aktiviteter eller arrangementer.' : 'Hello and welcome! Ask me about rooms, food, times, activities or events.', []];
    if (/takk|thank/.test(f) && f.length < 25) return [nb ? 'Bare hyggelig! Vi gleder oss til å ta imot deg i Vrådal.' : 'You\'re welcome! We look forward to seeing you in Vrådal.', ['book']];
    // things the hotel has not confirmed: hand over instead of matching something close
    if (/barneseng|reiseseng|ekstraseng|krybbe|\bcot\b|\bcrib\b|extra bed|romservice|room service|vaskeri|\brens\b|laundry|transfer|flyplass|airport|shuttle|massasje|massage|spa-?behandling|treatment|\btog\b|train/.test(f)) return null;
    // parking, EV charging, bus: answer with the real spots, distances, routes and a link to the map (like Hot Cut)
    const AR = k.arrival || [], here = (k.links || {}).finnfram;
    const pick = kind => AR.filter(x => x.kind === kind);
    const plist = xs => xs.map(x => `<li><b>${x.name}</b>${x.text} · ${x.m} m<br><a href="https://www.google.com/maps/dir/?api=1&destination=${x.lat},${x.lon}" target="_blank" rel="noopener">${nb ? 'Veibeskrivelse' : 'Directions'} ↗</a></li>`).join('');
    if (AR.length && /parker|parking|bobil|motorhome/.test(f)) return [nb ? 'Parkeringen er gratis, rett ved hotellet:' : 'Parking is free, right next to the hotel:', ['parkmap'], plist(pick('P'))];
    if (AR.length && /elbil|lading|lade\b|ladestasjon|charger|charging|\bev\b|tesla/.test(f)) return [nb ? 'Ja, du kan lade elbilen hos oss:' : 'Yes, you can charge your EV with us:', ['parkmap'], plist(pick('EV'))];
    if (AR.length && /buss|\bbus\b|kollektiv|public transport/.test(f)) return [nb ? 'Bussholdeplassen «Straand» ligger rett ved hotellet. Ruter og tider finner du hos Entur (entur.no).' : 'The bus stop "Straand" is right next to the hotel. Routes and times are on Entur (entur.no).', ['parkmap'], plist(pick('BUS'))];
    if (here && /adresse|address|hvor ligger|where is|veibeskriv|direction|kjore til|finne fram|get there|komme meg|kommer jeg/.test(f))
      return [(nb ? 'Vi ligger i ' : 'We are at ') + k.address + (nb ? ', i nordenden av Nisser. Gratis parkering rett ved hotellet.' : ', at the northern end of Lake Nisser. Free parking next to the hotel.'), ['map', 'parkmap']];
    // opening hours: answer from the hotel's own times, not the nearest FAQ
    if (/(^|\s)(apen|apent|apne|apner|open|opens|opening|apningstid\w*|hours|nar|when|tider|serveres|served)\b/.test(f)) {
      const H = [[/frokost|breakfast/, 'breakfast'], [/lunsj|lunch/, 'lunch'], [/afternoon|(^|\s)te\b|(^|\s)tea\b/, 'tea'], [/strandbar|beach/, 'beach'],
                 [/(^|\s)bar\b|frambar|fram bar|pianobar/, 'bar'], [/basseng|svomm|pool|swim|badstu|sauna/, 'pool'], [/resepsjon|reception/, 'reception'], [/ms fram|(^|\s)fram\b|bat|boat/, 'fram']];
      const hit = H.filter(([rx, key]) => rx.test(f) && t[key]).map(([, key]) => t[key]);
      if (hit.length) return [hit.join(' '), ['call']];
      if (/restaurant|middag|dinner|spise|eat|mat\b|food/.test(f))
        return [(nb ? 'Frokost: ' : 'Breakfast: ') + t.breakfast + '. ' + (nb ? 'Lunsj: ' : 'Lunch: ') + t.lunch + '. ' + (nb ? 'Middag: ' : 'Dinner: ') + t.dinner + '.', ['eat', 'call']];
    }
    // prices the pages state: packages and julebord ('hva koster alpinpakken?', 'julebord pris')
    if (/pris|koster|(^|\s)kost\b|price|cost|how much|hvor mye/.test(f) && (k.prods || []).length) {
      const words = x => fold(x).split(/[^a-z0-9]+/).filter(w => w.length > 2);   // plain words: the synonym list would match unrelated packages
      const qw = words(q).filter(w => !/^(pris|prisen|priser|koster|kost|price|prices|cost|costs|much|mye|hvor|what|hva|does|the|for|per|med|with|and|og|det|den|dere|you)$/.test(w));
      let bp = null, bs = 0;
      for (const p of k.prods) { const pw = words(p.n + ' ' + p.t); let s2 = 0;
        for (const w of qw) { if (pw.includes(w) || (w.length > 5 && pw.some(x => x.length > 5 && x.slice(0, 6) === w.slice(0, 6)))) s2 += 2; }   // whole word, or the same first six letters (alpinpakken = alpinpakke)
        if (s2 > bs) { bs = s2; bp = p; } }
      if (bp && bs >= 2) {
        return [bp.x || ((nb ? `${bp.n}: fra kr ${bp.p.toLocaleString('nb-NO')} per person. Se siden for hva som er inkludert: ` : `${bp.n}: from NOK ${bp.p.toLocaleString('en-GB')} per person. See the page for what is included: `) + location.origin + bp.u), bp.x ? ['events', 'call'] : ['book', 'call']];
      }
      if (!/(^|\s)(rom|rommet|rommene|room|rooms|overnatting|natt|netter|night|nights|stay|opphold|book|bestill|ledig|availab)\b/.test(f) && qw.length) return null;   // a price we do not have: reception answers, never the room-rate reply
    }
    const topic = /julebord|christmas|festival|bryllup|wedding|konferanse|conference|kurs\b|meeting|selskap|party/.test(f);   // named events go to the knowledge base
    if (!topic && /pris|koster|(^|\s)kost\b|price|cost|(^|\s)rates?\b|tilbud|deal|ledig|availab|book|bestill/.test(f) && !/(^|\s)(bord|bordet|table)\b/.test(f))
      return [nb ? 'Prisen avhenger av datoer og romtype. Velg datoer, så ser du ledige rom og dagens priser i bookingen. Bestiller du direkte hos oss, kan du avbestille til kl. 14.00 dagen før ankomst.'
                 : 'The price depends on your dates and room type. Choose your dates to see available rooms and today\'s rates. Booking direct with us lets you cancel until 2 pm the day before arrival.', ['book', 'call']];
    if (!topic && /(^|\s)(bord|bordet|table)\b|reserv/.test(f)) return [(nb ? 'Bordbestilling gjør du enklest på telefon: ' : 'The easiest way to book a table is by phone: ') + k.phone + '. ' + (nb ? 'Middag: ' : 'Dinner: ') + t.dinner + '.', ['call', 'eat']];
    if (/adresse|address|hvor ligger|where is|veibeskriv|direction|kjore til|finne fram|get there/.test(f))
      return [(nb ? 'Vi ligger i ' : 'We are at ') + k.address + (nb ? ', i nordenden av Nisser i Vest-Telemark.' : ', at the northern end of Lake Nisser in West Telemark.'), ['map', 'call']];
    if (/telefon|(^|\s)ringe?\b|phone|(^|\s)call|e-?post|email|mail|kontakt|contact|resepsjon|reception/.test(f))
      return [(nb ? 'Ring ' : 'Call ') + k.phone + ' (' + (t.reception || '').toLowerCase() + ')' + (nb ? ' eller skriv til ' : ' or email ') + k.email + '.', ['call', 'mail']];
    if (/(^|\s)(rom|rommene|romtype|rooms?)\b|suite|enkeltrom|dobbeltrom/.test(f) && !/lekerom|playroom|rullestol|handicap|tilgjengelig|accessib|wheelchair|famil|barn|child|kids/.test(f))
      return [(nb ? 'Vi har 125 rom: ' : 'We have 125 rooms: ') + k.rooms.join(', ').toLowerCase() + '. ' + (nb ? 'Alle har TV og trådløst nett.' : 'All have TV and wifi.'), ['rooms', 'book']];

    const qt = tokens(q); if (!qt.length) return null;
    let best = null, bestS = 0;
    for (const it of k.items) {
      const tq = tokens(it.q), ta = tokens(it.a); let s = 0;
      for (const w of qt) { if (tq.includes(w)) s += 3; else if (ta.includes(w)) s += 1; else if (w.length > 4 && tq.some(x => x.startsWith(w.slice(0, 5)))) s += 1.5; }
      s = s / Math.sqrt(qt.length) + (it.k === 'faq' ? .4 : 0);
      if (s > bestS) { bestS = s; best = it; }
    }
    if (!best || bestS < 1.6) return null;
    const acts = { faq: ['book'], room: ['rooms', 'book'], venue: ['eat', 'call'], season: ['book'], event: ['events', 'call'], history: [], meet: ['meet', 'mail'] }[best.k] || [];
    return [best.k === 'faq' ? best.a : `${best.q}: ${best.a}`, acts];
  }

  /* ---------- chat ---------- */
  const say = (text, who, acts = [], html = '') => {
    const m = document.createElement('div'); m.className = 'msg ' + who; m.textContent = text;
    if (html) { const l = document.createElement('ul'); l.className = 'plist'; l.innerHTML = html; m.append(l); }
    if (acts.length) { const a = document.createElement('div'); a.className = 'acts';
      acts.forEach(k => { const [l, h, c] = ACT[k]; const x = document.createElement('a'); x.textContent = l; x.href = h; if (c) x.className = c;
        if (/^https?:/.test(h)) { x.target = '_blank'; x.rel = 'noopener'; } x.dataset.cta = 'host-' + k; a.append(x); });
      m.append(a); }
    log.append(m); log.scrollTop = log.scrollHeight; return m;
  };
  function ask(q) {
    q = q.trim(); if (!q) return;
    say(q, 'me'); input.value = '';
    const typing = say('…', 'bot typing');
    window.dataLayer?.push({ event: 'host_question', q: q.slice(0, 120) });
    setTimeout(() => {
      typing.remove();
      const r = answer(q);
      if (r) { say(r[0], 'bot', r[1], r[2]); window.STSpeak?.(r[0]); }
      else { const m = nb ? `Det vil jeg ikke svare på uten å være sikker. Resepsjonen hjelper deg gjerne, hele døgnet: ${K().phone}.`
                          : `I'd rather not guess on that one. Reception is happy to help, 24 hours a day: ${K().phone}.`;
             say(m, 'bot', ['call', 'mail', 'faq']); window.STSpeak?.(m); }
    }, 450 + Math.random() * 350);
  }
  form.addEventListener('submit', e => { e.preventDefault(); ask(input.value); });

  /* voice: tap the mic and talk (Web Speech API; Chrome, Edge, Safari). Words appear live in the field and are sent when
     the guest stops talking. Questions asked by voice are answered aloud too (speechSynthesis), unless the guest mutes it. */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const mic = document.getElementById('hostMic'), speakBtn = document.getElementById('hostSpeak');
  let rec = null, listening = false, viaVoice = false, speakOn = true;
  try { speakOn = localStorage.getItem('st-speak') !== '0'; } catch (e) {}
  const setSpeak = on => { speakOn = on; speakBtn.setAttribute('aria-pressed', on); try { localStorage.setItem('st-speak', on ? '1' : '0'); } catch (e) {} if (!on) speechSynthesis?.cancel(); };
  const quick = document.getElementById('hostMicQuick');
  if (!SR && mic) {                                    // browser without speech recognition (e.g. Firefox): say so instead of hiding the mic
    mic.classList.add('off');
    mic.addEventListener('click', () => say(nb ? 'Tale fungerer i Chrome, Edge og Safari. I denne nettleseren kan du skrive spørsmålet ditt.' : 'Voice works in Chrome, Edge and Safari. In this browser, please type your question.', 'bot'));
  }
  const talk = () => { open(); hush(); setTimeout(() => mic?.click(), 250); };
  quick?.addEventListener('click', talk);
  document.addEventListener('click', e => { if (e.target.closest('[data-open-voice]')) talk(); });
  if (SR && mic) {
    box.querySelector('.mic-note').hidden = false;
    rec = new SR(); rec.lang = nb ? 'nb-NO' : 'en-GB'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    rec.onresult = e => { let t = ''; for (const r of e.results) t += r[0].transcript; input.value = t;
      if (e.results[e.results.length - 1].isFinal) { viaVoice = true; ask(t); } };
    rec.onend = () => { listening = false; mic.setAttribute('aria-pressed', 'false'); mic.classList.remove('on'); input.placeholder = input.dataset.ph; };
    rec.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed')
      say(nb ? 'Mikrofonen er blokkert i nettleseren. Du kan tillate den i adressefeltet, eller skrive spørsmålet.' : 'The microphone is blocked in your browser. Allow it in the address bar, or type your question.', 'bot'); };
    input.dataset.ph = input.placeholder;
    mic.addEventListener('click', () => {
      if (listening) { rec.stop(); return; }
      speechSynthesis?.cancel(); input.value = '';
      try { rec.start(); listening = true; mic.setAttribute('aria-pressed', 'true'); mic.classList.add('on'); input.placeholder = nb ? 'Jeg lytter …' : 'Listening …';
        window.dataLayer?.push({ event: 'concierge_voice' }); } catch (e) {}
    });
  }
  if ('speechSynthesis' in window && speakBtn) {
    speakBtn.addEventListener('click', () => setSpeak(!speakOn)); setSpeak(speakOn);
  }
  const voiceFor = lang => (speechSynthesis.getVoices() || []).find(v => v.lang && v.lang.toLowerCase().startsWith(lang)) || null;
  window.STSpeak = text => {
    if (!viaVoice || !speakOn || !('speechSynthesis' in window)) return; viaVoice = false;
    const u = new SpeechSynthesisUtterance(text.replace(/\+47 ?/g, '').replace(/–/g, ' til ')); u.lang = nb ? 'nb-NO' : 'en-GB';
    const v = voiceFor(nb ? 'nb' : 'en') || (nb ? voiceFor('no') : null); if (v) u.voice = v; u.rate = 1.02;
    speechSynthesis.cancel(); speechSynthesis.speak(u); speakBtn.hidden = false;
  };
  box.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => ask(c.textContent)));
})();
