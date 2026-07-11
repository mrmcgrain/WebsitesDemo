(() => {
  const root = document.documentElement;
  const body = document.body;
  const stage = document.querySelector('.machine-stage');
  const gear = document.querySelector('.gear');
  const gearWrap = document.querySelector('.gear-wrap');
  const gearBody = document.querySelector('.gear-body');
  const teethGroup = document.querySelector('.teeth');
  const rivetsGroup = document.querySelector('.rivets');
  const intro = document.querySelector('.intro-copy');
  const warning = document.querySelector('.warning-copy');
  const ending = document.querySelector('.end-copy');
  const scrollCue = document.querySelector('.scroll-cue');
  const chapter = document.querySelector('.chapter');
  const needles = document.querySelectorAll('.needle');
  const canvas = document.querySelector('#sparkCanvas');
  const ctx = canvas.getContext('2d');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const teeth = [];
  const spokes = [...document.querySelectorAll('.spoke')].map((el, index) => ({
    el,
    index,
    degrees: Number(el.dataset.angle),
    angle: (Number(el.dataset.angle) - 90) * Math.PI / 180,
    seed: .86 + ((index * 13) % 9) / 20
  }));
  const rivets = [];
  const debris = [];
  const sparks = [];
  let scrollProgress = 0;
  let angle = 0;
  let lastTime = performance.now();
  let lastProgress = 0;
  let shockFired = false;

  const makeSVG = (tag, attrs) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    return el;
  };

  for (let i = 0; i < 28; i++) {
    const degrees = i * (360 / 28);
    const assembly = makeSVG('g', { class: 'tooth-assembly' });
    const tooth = makeSVG('path', {
      d: 'M281 101 L278 70 Q278 56 290 51 Q300 46 310 51 Q322 56 322 70 L319 101 Z',
      class: 'tooth'
    });
    const bolt = makeSVG('circle', {
      cx: 300,
      cy: 69,
      r: 11,
      class: 'tooth-bolt',
      fill: 'url(#outerSphere)',
      stroke: '#2a140b',
      'stroke-width': 3
    });
    const boltGlint = makeSVG('circle', {
      cx: 296.5,
      cy: 65.5,
      r: 2.5,
      class: 'tooth-glint',
      fill: '#ffe1a0',
      opacity: .72
    });
    assembly.append(tooth, bolt, boltGlint);
    teethGroup.appendChild(assembly);
    const a = (degrees - 90) * Math.PI / 180;
    teeth.push({ el: assembly, angle: a, degrees, seed: .72 + ((i * 17) % 31) / 50 });
  }

  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const rivet = makeSVG('circle', {
      cx: 300 + Math.cos(a) * 96,
      cy: 300 + Math.sin(a) * 96,
      r: 8,
      class: 'rivet'
    });
    rivetsGroup.appendChild(rivet);
    rivets.push({ el: rivet, angle: a, seed: .8 + i * .08 });
  }

  function resize() {
    const dpr = Math.min(devicePixelRatio, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function range(value, start, end) {
    return Math.max(0, Math.min(1, (value - start) / (end - start)));
  }

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function updateScroll() {
    const max = stage.offsetHeight - innerHeight;
    scrollProgress = Math.max(0, Math.min(1, -stage.getBoundingClientRect().top / max));
    root.style.setProperty('--progress', scrollProgress.toFixed(4));
  }

  function spawnBurst(count = 10, force = 1) {
    const rect = gearWrap.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = (2 + Math.random() * 8) * force;
      sparks.push({
        x, y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 1,
        decay: .012 + Math.random() * .025,
        size: .5 + Math.random() * 2.4
      });
    }
  }

  function renderSparks() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.x += p.vx; p.y += p.vy; p.vy += .11; p.vx *= .992; p.life -= p.decay;
      if (p.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 2.5, p.y - p.vy * 2.5);
      ctx.strokeStyle = `rgba(255, ${90 + p.life * 130}, 40, ${p.life})`;
      ctx.lineWidth = p.size;
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function animate(now) {
    const dt = Math.min(35, now - lastTime) / 16.67;
    lastTime = now;
    const p = scrollProgress;
    const velocity = Math.abs(p - lastProgress);
    lastProgress += (p - lastProgress) * .12;

    const rpm = reducedMotion ? 0 : .15 + Math.pow(p, 2.6) * 15 + velocity * 170;
    angle += rpm * dt;
    const failure = range(p, .68, .91);
    const aftermath = range(p, .9, 1);
    const shake = reducedMotion ? 0 : Math.pow(range(p, .45, .85), 2) * 10 * (1 - aftermath);
    gearWrap.style.setProperty('--shake-x', `${(Math.random() - .5) * shake}px`);
    gearWrap.style.setProperty('--shake-y', `${(Math.random() - .5) * shake}px`);
    gear.style.transform = `rotate(${angle}deg) scale(${1 + Math.sin(now * .025) * failure * .012})`;
    gearWrap.style.opacity = `${1 - easeOut(aftermath)}`;

    gearBody.style.transform = failure > 0
      ? `translate(${Math.sin(now * .035) * failure * 9}px, ${Math.cos(now * .029) * failure * 7}px) scale(${1 - aftermath * .28})`
      : '';

    teeth.forEach((tooth, i) => {
      const local = range(failure, i / teeth.length * .42, .46 + i / teeth.length * .32);
      const d = easeOut(local) * (115 + tooth.seed * 260);
      const spin = local * (180 + i * 31) * (i % 2 ? 1 : -1);
      tooth.el.style.transform = `rotate(${tooth.degrees + spin}deg) translateY(${-d}px) scale(${1 - aftermath * .55})`;
      tooth.el.style.opacity = `${1 - aftermath}`;
    });

    spokes.forEach((spoke, i) => {
      const flex = range(failure, .08 + i * .018, .32 + i * .018);
      const detach = range(failure, .36 + i * .032, .74 + i * .025);
      const d = easeOut(detach) * (185 + spoke.seed * 130);
      const wobble = flex * Math.sin(now * .06 + i * 1.7) * 5;
      const spin = easeOut(detach) * (110 + i * 29) * (i % 2 ? -1 : 1);
      const sideways = Math.sin(i * 2.4) * detach * 38;
      spoke.el.style.transform = `rotate(${spoke.degrees + wobble + spin}deg) translate(${sideways}px, ${-d}px) scale(${1 - detach * .16 - aftermath * .38})`;
      spoke.el.style.opacity = `${1 - aftermath}`;
    });

    rivets.forEach((rivet, i) => {
      const local = range(failure, .18 + i * .025, .62 + i * .025);
      const d = easeOut(local) * (150 + rivet.seed * 190);
      rivet.el.style.transform = `translate(${Math.cos(rivet.angle) * d}px, ${Math.sin(rivet.angle) * d + local * local * 80}px) scale(${1 - aftermath * .5})`;
      rivet.el.style.opacity = `${1 - aftermath}`;
    });

    const introFade = 1 - range(p, .13, .28);
    intro.style.opacity = introFade;
    intro.style.transform = `translateY(calc(-50% - ${range(p,.08,.3) * 35}px))`;
    warning.style.opacity = range(p, .36, .5) * (1 - range(p, .76, .86));
    warning.style.transform = `translateY(calc(-50% + ${(Math.random() - .5) * shake * .6}px))`;
    ending.style.opacity = range(p, .91, .97);
    ending.style.transform = `translate(-50%, -50%) scale(${.96 + range(p,.91,.97) * .04})`;
    scrollCue.style.opacity = 1 - range(p, .03, .11);

    const needleAngle = -140 + Math.min(270, Math.pow(p, .72) * 300);
    needles.forEach((n, i) => n.style.transform = `rotate(${needleAngle + Math.sin(now * .04 + i) * failure * 16}deg)`);
    body.classList.toggle('critical', p > .5 && p < .94);
    body.classList.toggle('ending', p > .9);

    chapter.textContent = p < .22 ? '01 / IGNITION' : p < .5 ? '02 / ACCELERATION' : p < .72 ? '03 / REDLINE' : p < .92 ? '04 / RUPTURE' : '05 / SILENCE';

    if (p > .7 && p < .91 && Math.random() < failure * .22) spawnBurst(1 + Math.floor(failure * 3), .55 + failure);
    if (p > .72 && !shockFired) { spawnBurst(55, 1.25); shockFired = true; }
    if (p < .65) shockFired = false;

    renderSparks();
    requestAnimationFrame(animate);
  }

  addEventListener('resize', resize);
  addEventListener('scroll', updateScroll, { passive: true });
  resize();
  updateScroll();
  requestAnimationFrame(animate);
})();
