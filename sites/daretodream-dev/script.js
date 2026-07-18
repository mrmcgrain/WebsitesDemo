(() => {
  const canvas = document.querySelector('#orbit');
  const ctx = canvas.getContext('2d', { alpha: false });
  const headerCanvas = document.querySelector('#header-orbit');
  const headerCtx = headerCanvas.getContext('2d');
  const lightningCanvas = document.querySelector('#header-lightning');
  const lightningCtx = lightningCanvas.getContext('2d');
  const siteHeader = document.querySelector('.site-header');
  const story = document.querySelector('.scroll-story');
  const beats = [...document.querySelectorAll('.beat')];
  const progressFill = document.querySelector('.progress-fill');
  const progressNumber = document.querySelector('.progress-number');
  const chapterName = document.querySelector('.chapter-name');
  const stage = document.querySelector('.stage');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;

  const bodies = [
    { color: [255, 55, 82], phase: 0.00, label: 'Courage' },
    { color: [184, 235, 255], phase: 0.335, label: 'Curiosity' },
    { color: [246, 204, 87], phase: 0.67, label: 'Imagination' }
  ];

  let width = 0;
  let height = 0;
  let dpr = 1;
  let targetProgress = 0;
  let smoothProgress = 0;
  let mouseX = 0;
  let mouseY = 0;
  let raf = 0;
  let nextLightning = 1600 + Math.random() * 1800;
  let lightningCount = 0;
  const lightningBolts = [];

  function clamp(value, min = 0, max = 1) {
    return Math.min(max, Math.max(min, value));
  }

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const headerRect = siteHeader.getBoundingClientRect();
    lightningCanvas.width = Math.round(headerRect.width * dpr);
    lightningCanvas.height = Math.round(headerRect.height * dpr);
    lightningCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function lemniscate(t, scale = 1) {
    const angle = t * TAU;
    const span = Math.min(width * 0.34, height * 0.47) * scale;
    // Gerono lemniscate: broad, circular lobes with a clean central crossing.
    // The previous Bernoulli curve compressed the outer loops too sharply.
    return {
      x: width * 0.5 + span * 1.2 * Math.cos(angle),
      y: height * 0.5 + span * 0.52 * Math.sin(angle * 2)
    };
  }

  function rgba(color, alpha) {
    return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
  }

  function drawBackground(progress) {
    const gradient = ctx.createRadialGradient(width * .5, height * .5, 0, width * .5, height * .5, Math.max(width, height) * .7);
    gradient.addColorStop(0, '#090909');
    gradient.addColorStop(.46, '#040404');
    gradient.addColorStop(1, '#000');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width * .5, height * .5, 0, width * .5, height * .5, Math.min(width, height) * .2);
    glow.addColorStop(0, `rgba(180, 215, 255, ${.025 + progress * .018})`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  function drawBasePath(progress) {
    ctx.save();
    ctx.translate(mouseX * 7, mouseY * 5);
    ctx.beginPath();
    for (let i = 0; i <= 420; i++) {
      const point = lemniscate(i / 420, .98 + Math.sin(progress * Math.PI) * .025);
      i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(214, 223, 226, .26)';
    ctx.lineWidth = .75;
    ctx.shadowColor = 'rgba(190, 220, 255, .22)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();
  }

  function drawTrail(body, position, progress) {
    const trailLength = .19 + .025 * Math.sin(progress * TAU + body.phase * 9);
    const segments = 78;
    ctx.save();
    ctx.translate(mouseX * 7, mouseY * 5);
    for (let i = segments; i > 0; i--) {
      const age = i / segments;
      const from = lemniscate(position - age * trailLength);
      const to = lemniscate(position - (age - 1 / segments) * trailLength);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = rgba(body.color, .025 + .63 * (1 - age) ** 2.4);
      ctx.lineWidth = .55 + 1.5 * (1 - age);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBody(body, position, index) {
    const point = lemniscate(position);
    point.x += mouseX * 7;
    point.y += mouseY * 5;
    const pulse = 1 + Math.sin(smoothProgress * TAU * 4 + index * 2.1) * .08;
    const radius = (width < 700 ? 4.5 : 5.5) * pulse;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 9);
    glow.addColorStop(0, rgba(body.color, 1));
    glow.addColorStop(.12, rgba(body.color, .88));
    glow.addColorStop(.42, rgba(body.color, .18));
    glow.addColorStop(1, rgba(body.color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius * 9, 0, TAU);
    ctx.fill();

    ctx.shadowColor = rgba(body.color, 1);
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius * .42, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawHeaderOrbit(timestamp) {
    const w = headerCanvas.width;
    const h = headerCanvas.height;
    const centerX = w * .5;
    const centerY = h * .5;
    const time = timestamp * .000085;

    headerCtx.clearRect(0, 0, w, h);
    headerCtx.beginPath();
    for (let i = 0; i <= 180; i++) {
      const angle = (i / 180) * TAU;
      const x = centerX + 112 * Math.cos(angle);
      const y = centerY + 27 * Math.sin(angle * 2);
      i ? headerCtx.lineTo(x, y) : headerCtx.moveTo(x, y);
    }
    headerCtx.closePath();
    headerCtx.strokeStyle = 'rgba(220, 228, 232, .38)';
    headerCtx.lineWidth = 1.1;
    headerCtx.stroke();

    bodies.forEach((body, index) => {
      const angle = (time + body.phase) * TAU;
      const x = centerX + 112 * Math.cos(angle);
      const y = centerY + 27 * Math.sin(angle * 2);
      const radius = 3.2;
      const glow = headerCtx.createRadialGradient(x, y, 0, x, y, 14);
      glow.addColorStop(0, rgba(body.color, 1));
      glow.addColorStop(.22, rgba(body.color, .88));
      glow.addColorStop(1, rgba(body.color, 0));
      headerCtx.fillStyle = glow;
      headerCtx.beginPath();
      headerCtx.arc(x, y, 14, 0, TAU);
      headerCtx.fill();
      headerCtx.fillStyle = '#fff';
      headerCtx.beginPath();
      headerCtx.arc(x, y, radius, 0, TAU);
      headerCtx.fill();
    });
  }

  function createLightning(timestamp, strong = false) {
    const headerWidth = siteHeader.clientWidth;
    const headerHeight = siteHeader.clientHeight;
    const segments = strong ? 12 : 9;
    const centerX = headerWidth * (.07 + Math.random() * .86);
    const points = [];
    const branches = [];

    for (let i = 0; i <= segments; i++) {
      const progress = i / segments;
      const wave = Math.sin(progress * Math.PI * (2 + Math.random() * 2)) * 8;
      points.push({
        x: clamp(centerX + wave + (Math.random() - .5) * (strong ? 28 : 18), 4, headerWidth - 4),
        y: -5 + progress * (headerHeight + 10)
      });
    }

    const branchCount = strong ? 4 : 2;
    for (let i = 0; i < branchCount; i++) {
      const anchorIndex = 3 + Math.floor(Math.random() * (segments - 5));
      const anchor = points[anchorIndex];
      const direction = Math.random() > .5 ? 1 : -1;
      branches.push([
        anchor,
        { x: anchor.x + direction * (12 + Math.random() * 25), y: anchor.y + 7 + Math.random() * 10 },
        { x: anchor.x + direction * (25 + Math.random() * 38), y: anchor.y + 15 + Math.random() * 17 }
      ]);
    }

    lightningBolts.push({
      born: timestamp,
      duration: strong ? 360 : 175,
      strong,
      points,
      branches
    });
  }

  function strokeLightningPath(points, alpha, strong) {
    lightningCtx.beginPath();
    points.forEach((point, index) => index ? lightningCtx.lineTo(point.x, point.y) : lightningCtx.moveTo(point.x, point.y));
    lightningCtx.shadowColor = strong ? 'rgba(196, 225, 255, .95)' : 'rgba(142, 205, 255, .62)';
    lightningCtx.shadowBlur = strong ? 13 : 7;
    lightningCtx.strokeStyle = `rgba(135, 201, 255, ${alpha * .34})`;
    lightningCtx.lineWidth = strong ? 3 : 1.7;
    lightningCtx.stroke();
    lightningCtx.shadowBlur = strong ? 6 : 3;
    lightningCtx.strokeStyle = `rgba(244, 250, 255, ${alpha})`;
    lightningCtx.lineWidth = strong ? 1.15 : .65;
    lightningCtx.stroke();
  }

  function drawHeaderLightning(timestamp) {
    const headerWidth = siteHeader.clientWidth;
    const headerHeight = siteHeader.clientHeight;
    lightningCtx.clearRect(0, 0, headerWidth, headerHeight);
    if (reducedMotion) return;

    if (timestamp >= nextLightning) {
      lightningCount += 1;
      const strong = lightningCount % 6 === 0 || Math.random() < .13;
      createLightning(timestamp, strong);
      if (strong) createLightning(timestamp + 78, true);
      nextLightning = timestamp + (strong ? 4600 : 2400) + Math.random() * (strong ? 3600 : 4200);
    }

    for (let i = lightningBolts.length - 1; i >= 0; i--) {
      const bolt = lightningBolts[i];
      const age = timestamp - bolt.born;
      if (age < 0) continue;
      if (age > bolt.duration) {
        lightningBolts.splice(i, 1);
        continue;
      }

      const life = 1 - age / bolt.duration;
      const flicker = .52 + .48 * Math.abs(Math.sin(age * .095));
      const alpha = life * flicker * (bolt.strong ? .82 : .42);
      if (bolt.strong) {
        lightningCtx.fillStyle = `rgba(178, 216, 255, ${alpha * .055})`;
        lightningCtx.fillRect(0, 0, headerWidth, headerHeight);
      }
      strokeLightningPath(bolt.points, alpha, bolt.strong);
      bolt.branches.forEach((branch) => strokeLightningPath(branch, alpha * .48, false));
    }

    lightningCtx.shadowBlur = 0;
  }

  function render(timestamp = 0) {
    const easing = reducedMotion ? 1 : .075;
    smoothProgress += (targetProgress - smoothProgress) * easing;
    if (Math.abs(targetProgress - smoothProgress) < .00005) smoothProgress = targetProgress;

    drawBackground(smoothProgress);
    drawBasePath(smoothProgress);

    // Four full revolutions over the pinned sequence. The slight sinusoidal term
    // produces a gravitational acceleration feel while remaining scroll-reversible.
    const orbitTime = smoothProgress * 4 + Math.sin(smoothProgress * TAU * 2) * .025;
    bodies.forEach((body) => drawTrail(body, orbitTime + body.phase, smoothProgress));
    bodies.forEach((body, index) => drawBody(body, orbitTime + body.phase, index));
    drawHeaderOrbit(timestamp);
    drawHeaderLightning(timestamp);

    raf = requestAnimationFrame(render);
  }

  function updateScroll() {
    const rect = story.getBoundingClientRect();
    const travel = story.offsetHeight - window.innerHeight;
    targetProgress = clamp(-rect.top / travel);
    document.body.classList.toggle('is-past-story', rect.bottom <= window.innerHeight * .5);
    stage.classList.toggle('has-scrolled', targetProgress > .025);
    progressFill.style.width = `${targetProgress * 100}%`;
    progressNumber.textContent = String(Math.round(targetProgress * 100)).padStart(2, '0');

    beats.forEach((beat) => {
      const start = Number(beat.dataset.start);
      const end = Number(beat.dataset.end);
      beat.classList.toggle('is-active', targetProgress >= start && targetProgress < end);
    });

    const chapters = ['THE ORBIT', 'THE PULL', 'THE UNKNOWN', 'THE LEAP', 'THE POSSIBILITY'];
    chapterName.textContent = chapters[Math.min(4, Math.floor(targetProgress * 5))];
  }

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => entry.target.classList.toggle('in-view', entry.isIntersecting));
  }, { threshold: .14 });
  document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

  window.addEventListener('resize', () => { resize(); updateScroll(); }, { passive: true });
  window.addEventListener('scroll', updateScroll, { passive: true });
  window.addEventListener('pointermove', (event) => {
    if (reducedMotion) return;
    mouseX = (event.clientX / width - .5) * 2;
    mouseY = (event.clientY / height - .5) * 2;
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else render();
  });

  resize();
  updateScroll();
  render();
})();

(() => {
  const NULLCORP_PROJECT_URL = ''; // TODO: Add the real NullCorp 3D project URL when it is available.
  const selectorInputs = [...document.querySelectorAll('input[name="project-path"]')];
  const recommendation = document.querySelector('#path-recommendation');
  const pathStart = document.querySelector('.path-start');
  const serviceSelect = document.querySelector('#service-interest');
  const hostingCheckbox = document.querySelector('input[name="Managed hosting interest"]');
  const nullcorpLink = document.querySelector('.nullcorp-link');
  const form = document.querySelector('#project-form');
  const nextInput = document.querySelector('#form-next');
  const successMessage = document.querySelector('#project-success');

  const paths = {
    'first-website': {
      service: 'Business website',
      message: 'Start with a focused business website that clearly explains your value, builds trust, and gives customers an easy next step.'
    },
    'website-help': {
      service: 'Website refactoring',
      message: 'A website refactor can improve the experience you already have—design, speed, accessibility, security, and maintainability included.'
    },
    launching: {
      service: 'Landing page',
      message: 'A focused landing page is a practical way to launch the offer, campaign, event, or idea with one clear outcome.'
    },
    interactive: {
      service: '3D or interactive website',
      message: 'An interactive experience can turn your story into something people explore, remember, and want to share.'
    },
    hosting: {
      service: 'Managed hosting and care',
      message: 'Managed hosting and care gives you dependable deployment, monitoring, security, backups, and a real path for continued support.'
    }
  };

  selectorInputs.forEach((input) => {
    input.addEventListener('change', () => {
      const selected = paths[input.value];
      recommendation.textContent = selected.message;
      pathStart.hidden = false;
      serviceSelect.value = selected.service;
      if (input.value === 'hosting') hostingCheckbox.checked = true;
    });
  });

  pathStart.addEventListener('click', () => {
    window.setTimeout(() => serviceSelect.focus({ preventScroll: true }), 550);
  });

  if (NULLCORP_PROJECT_URL) {
    nullcorpLink.href = NULLCORP_PROJECT_URL;
    nullcorpLink.textContent = 'Explore the experiment';
    nullcorpLink.removeAttribute('aria-disabled');
  } else {
    nullcorpLink.addEventListener('click', (event) => event.preventDefault());
  }

  document.querySelector('#current-year').textContent = String(new Date().getFullYear());

  if (location.protocol === 'http:' || location.protocol === 'https:') {
    nextInput.value = `${location.origin}${location.pathname}?submitted=true#project-success`;
  }

  function fieldFor(control) {
    return control.closest('.field');
  }

  function errorFor(control) {
    const describedBy = control.getAttribute('aria-describedby');
    return describedBy ? document.getElementById(describedBy) : null;
  }

  function validationMessage(control) {
    if (control.validity.valueMissing) return 'Please complete this field.';
    if (control.validity.typeMismatch) return 'Please enter a valid email address.';
    if (control.validity.badInput) return 'Please check this value.';
    return control.validationMessage || 'Please check this field.';
  }

  function showValidation(control) {
    const field = fieldFor(control);
    const error = errorFor(control);
    if (!field || !error) return;
    const invalid = !control.validity.valid;
    field.classList.toggle('is-invalid', invalid);
    control.setAttribute('aria-invalid', String(invalid));
    error.textContent = invalid ? validationMessage(control) : '';
  }

  form.querySelectorAll('[required]').forEach((control) => {
    control.addEventListener('invalid', (event) => {
      event.preventDefault();
      showValidation(control);
    });
    control.addEventListener('input', () => showValidation(control));
    control.addEventListener('change', () => showValidation(control));
  });

  form.addEventListener('submit', (event) => {
    if (form.checkValidity()) return;
    event.preventDefault();
    const firstInvalid = form.querySelector(':invalid');
    form.querySelectorAll('[required]').forEach(showValidation);
    firstInvalid?.focus();
  });

  const wasSubmitted = new URLSearchParams(location.search).get('submitted') === 'true';
  if (wasSubmitted) {
    successMessage.hidden = false;
    successMessage.focus({ preventScroll: true });
  }
})();
