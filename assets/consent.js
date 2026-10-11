/* Cookie consent (GDPR, Norwegian ekomloven § 3-15 / Datatilsynet guidance): nothing optional runs before a choice.
 * - "Godta alle" and "Kun nødvendige" are equal buttons; no pre-ticked boxes; choice kept 12 months.
 * - Categories: necessary (always), statistics, marketing, external media (YouTube film, map).
 * - Google consent mode defaults to "denied", so a tag manager added later only fires after consent.
 * - window.STConsent.has('media') gates embeds; 'st-consent' event fires on every change.
 * - Any [data-cookie-settings] element reopens the dialog. Policy URLs come from data-cookies / data-privacy.
 */
(() => {
  const me = document.currentScript, KEY = 'st-consent', MAX_AGE = 365 * 24 * 3600 * 1000;
  const en = (document.documentElement.lang || '').startsWith('en');
  const T = en ? {
    title: 'Cookies on straand.no', text: 'We use necessary cookies so the site works. With your consent we also use cookies for statistics and marketing, and we show content from YouTube and OpenStreetMap. You can change your choice at any time.',
    all: 'Accept all', nec: 'Necessary only', custom: 'Choose', save: 'Save choice', more: 'Cookie policy', priv: 'Privacy',
    cats: [['necessary', 'Necessary', 'Your cookie choice, light/dark theme and the concierge state. Always on.'],
           ['statistics', 'Statistics', 'Anonymous statistics about how the site is used.'],
           ['marketing', 'Marketing', 'Measuring our campaigns and showing relevant ads.'],
           ['media', 'External media', 'Our film on YouTube and the map from OpenStreetMap. These services can set their own cookies.']]
  } : {
    title: 'Informasjonskapsler på straand.no', text: 'Vi bruker nødvendige informasjonskapsler slik at siden virker. Med ditt samtykke bruker vi også informasjonskapsler til statistikk og markedsføring, og vi viser innhold fra YouTube og OpenStreetMap. Du kan endre valget når som helst.',
    all: 'Godta alle', nec: 'Kun nødvendige', custom: 'Velg selv', save: 'Lagre valg', more: 'Om informasjonskapsler', priv: 'Personvern',
    cats: [['necessary', 'Nødvendige', 'Husker valget ditt, lys/mørk visning og conciergen. Alltid på.'],
           ['statistics', 'Statistikk', 'Anonym statistikk om hvordan siden brukes.'],
           ['marketing', 'Markedsføring', 'Måling av kampanjer og relevante annonser.'],
           ['media', 'Eksterne medier', 'Filmen vår på YouTube og kartet fra OpenStreetMap. Disse tjenestene kan sette egne informasjonskapsler.']]
  };
  const cookiesUrl = me?.dataset.cookies || '#', privacyUrl = me?.dataset.privacy || '#';

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', functionality_storage: 'granted', security_storage: 'granted', wait_for_update: 500 });

  const read = () => { try { const c = JSON.parse(localStorage.getItem(KEY)); return c && Date.now() - new Date(c.t).getTime() < MAX_AGE ? c : null; } catch (e) { return null; } };
  let state = read();
  function apply(c) {
    state = c;
    gtag('consent', 'update', { analytics_storage: c.statistics ? 'granted' : 'denied', ad_storage: c.marketing ? 'granted' : 'denied', ad_user_data: c.marketing ? 'granted' : 'denied', ad_personalization: c.marketing ? 'granted' : 'denied' });
    dataLayer.push({ event: 'consent_update', consent_statistics: c.statistics, consent_marketing: c.marketing, consent_media: c.media });
    document.dispatchEvent(new CustomEvent('st-consent', { detail: c }));
  }
  function save(statistics, marketing, media) {
    const c = { v: 1, t: new Date().toISOString(), statistics, marketing, media };
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
    apply(c); close();
  }

  let box;
  function build() {
    box = document.createElement('section');
    box.className = 'cc'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-labelledby', 'ccTitle'); box.setAttribute('aria-describedby', 'ccText');
    const cur = read() || {};
    box.innerHTML = `
      <h2 id="ccTitle">${T.title}</h2>
      <p id="ccText">${T.text} <a href="${cookiesUrl}">${T.more}</a> · <a href="${privacyUrl}">${T.priv}</a></p>
      <div class="cc-cats" hidden>${T.cats.map(([k, n, d], i) => `
        <label class="cc-cat"><span><b>${n}</b><small>${d}</small></span>
          <input type="checkbox" data-k="${k}" ${i === 0 ? 'checked disabled' : (cur[k] ? 'checked' : '')}><i class="cc-sw" aria-hidden="true"></i></label>`).join('')}
      </div>
      <div class="cc-btns">
        <button type="button" class="cc-b" data-a="all">${T.all}</button>
        <button type="button" class="cc-b" data-a="nec">${T.nec}</button>
        <button type="button" class="cc-b ghost" data-a="custom">${T.custom}</button>
      </div>`;
    document.body.appendChild(box);
    box.addEventListener('click', e => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      const v = k => box.querySelector(`[data-k="${k}"]`).checked;
      if (a === 'all') save(true, true, true);
      else if (a === 'nec') save(false, false, false);
      else if (a === 'custom') { box.querySelector('.cc-cats').hidden = false; e.target.dataset.a = 'save'; e.target.textContent = T.save; }
      else if (a === 'save') save(v('statistics'), v('marketing'), v('media'));
    });
  }
  function open(manual) { if (box) box.remove(); build(); requestAnimationFrame(() => box.classList.add('show')); if (!document.querySelector('dialog[open]') && (document.activeElement === document.body || !document.activeElement || manual === true)) box.querySelector('.cc-b')?.focus({ preventScroll: true }); }   // never pull focus away from what the visitor is doing
  function close() { if (!box) return; box.classList.remove('show'); const b = box; setTimeout(() => b.remove(), 300); box = null; }

  document.addEventListener('click', e => { if (e.target.closest('[data-cookie-settings]')) { e.preventDefault(); open(true); } });
  window.STConsent = { get: read, has: k => !!(state && state[k]), open: () => open(true), grant(k) { const c = { ...(state || { statistics: false, marketing: false, media: false }) }; c[k] = true; save(c.statistics, c.marketing, c.media); } };
  if (state) apply(state); else setTimeout(open, 1200);
})();
