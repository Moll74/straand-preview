/* Living hero photos: a small WebGL shader moves parts of each real photo, guided by a mask made per photo
 * (sites/<slug>/tools/motion_masks.py): R = foliage sways in gusts of wind, G = water ripples and glints,
 * B = a flag waves (or, with data-flame, a fire flickers), A = clouds drift. The photo itself is never replaced:
 * the canvas draws the same image on top of it and fades in only once it renders. Only the visible season
 * animates, nothing runs off screen, and it is skipped with prefers-reduced-motion or without WebGL. */
(() => {
  /* start after the page has loaded and the browser is idle: the photo is already showing, the motion joins in */
  const go = () => {
  const hero = document.getElementById('hero');
  if (!hero || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FS = `precision mediump float;
uniform sampler2D T,M;uniform vec2 C,I,O;uniform float t,F;
void main(){
  vec2 px=vec2(gl_FragCoord.x,C.y-gl_FragCoord.y);
  vec2 uv=(px-O)/I;                                         // object-fit: cover with the img's object-position
  vec4 m=texture2D(M,uv);
  float g=.55+.45*sin(t*.7)*sin(t*.23+1.3);                 // wind gusts
  vec2 d=vec2(0.);
  d.x+=m.r*.0032*g*sin(t*1.6+uv.y*9.+uv.x*4.);
  d.y+=m.r*.0014*g*sin(t*2.1+uv.x*11.);
  d.x+=m.g*.0016*sin(uv.y*260.-t*2.2);
  d.y+=m.g*.0011*sin(uv.x*90.+t*1.7+uv.y*40.);
  if(F<.5){d.y+=m.b*.0055*sin(uv.x*230.-t*9.);d.x+=m.b*.0018*sin(uv.y*160.-t*7.);}
  else{d.y+=m.b*.0035*(sin(t*13.+uv.x*300.)+sin(t*7.3))*.5;}
  d.x+=m.a*.010*sin(t*.07+uv.y*2.5);
  vec3 c=texture2D(T,clamp(uv+d,0.,1.)).rgb;
  c+=m.g*pow(max(0.,sin(uv.x*520.+t*3.)*sin(uv.y*760.-t*2.)),14.)*.28;
  if(F>.5)c*=1.+m.b*(.16*sin(t*17.)+.11*sin(t*29.+1.)+.06*sin(t*5.));
  gl_FragColor=vec4(c,1.);
}`;
  const figs = [...hero.querySelectorAll('.hero-photos figure[data-motion]')];
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  let visible = true;
  new IntersectionObserver(e => { visible = e[0].isIntersecting; if (visible) kick(); }).observe(hero);
  const live = [];
  figs.forEach(fig => {
    const im = fig.querySelector('img'); if (!im) return;
    if (im.dataset.src) { im.srcset = im.dataset.srcset; im.src = im.dataset.src; im.removeAttribute('data-src'); im.removeAttribute('data-srcset'); }   // a season photo not fetched yet
    const cv = document.createElement('canvas'); cv.className = 'gl'; cv.setAttribute('aria-hidden', 'true'); fig.append(cv);
    const gl = cv.getContext('webgl', { premultipliedAlpha: false, antialias: false }); if (!gl) return;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    const U = n => gl.getUniformLocation(pr, n);
    const tex = (unit, src) => { const tx = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tx);
      [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const f = unit ? gl.RGBA : gl.RGB; gl.texImage2D(gl.TEXTURE_2D, 0, f, f, gl.UNSIGNED_BYTE, src); };
    const L = { fig, cv, gl, ready: false, draw: null };
    const photo = new Image(); photo.src = im.currentSrc || im.src;            // same file the page already shows
    let mask;                                                                    // the mask's channels must stay exact: no premultiplied alpha
    Promise.all([photo.decode(), fetch(fig.dataset.motion).then(r => r.blob()).then(b => createImageBitmap(b, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })).then(m => { mask = m; })]).then(() => {
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      tex(0, photo); tex(1, mask); gl.uniform1i(U('T'), 0); gl.uniform1i(U('M'), 1); gl.uniform1f(U('F'), fig.dataset.flame ? 1 : 0);
      const size = () => {
        const w = cv.clientWidth, h = cv.clientHeight; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); gl.viewport(0, 0, cv.width, cv.height);
        const [ox, oy] = getComputedStyle(im).objectPosition.split(' ').map(v => parseFloat(v) / 100);
        const s = Math.max(cv.width / photo.naturalWidth, cv.height / photo.naturalHeight), dw = photo.naturalWidth * s, dh = photo.naturalHeight * s;
        gl.uniform2f(U('C'), cv.width, cv.height); gl.uniform2f(U('I'), dw, dh); gl.uniform2f(U('O'), (cv.width - dw) * (isNaN(ox) ? .5 : ox), (cv.height - dh) * (isNaN(oy) ? .5 : oy));
      };
      size(); addEventListener('resize', size);
      const tU = U('t');
      L.draw = now => { gl.uniform1f(tU, now / 1000); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); if (!L.ready) { L.ready = true; cv.classList.add('on'); } };
      L.draw(performance.now()); kick();
    }).catch(() => cv.remove());
    live.push(L);
  });
  let running = false;
  function loop(now) {
    if (!visible || document.hidden) { running = false; return; }
    live.forEach(L => { if (L.draw && L.fig.classList.contains('on')) L.draw(now); });
    requestAnimationFrame(loop);
  }
  function kick() { if (!running && live.length) { running = true; requestAnimationFrame(loop); } }
  document.addEventListener('visibilitychange', kick);
};
  const idle = window.requestIdleCallback || (f => setTimeout(f, 300));
  if (document.readyState === 'complete') idle(go); else addEventListener('load', () => idle(go));
})();
