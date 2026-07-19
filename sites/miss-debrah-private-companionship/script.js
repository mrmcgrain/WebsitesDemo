(() => {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReduced) document.documentElement.classList.add('has-motion');

  const ageGate = document.getElementById('ageGate');
  const enterSite = document.getElementById('enterSite');
  const ageAccepted = localStorage.getItem('missDebrahAgeOk') === 'true';
  if (ageAccepted) {
    ageGate.hidden = true;
  } else {
    document.body.classList.add('is-locked');
    setTimeout(() => enterSite?.focus(), 50);
  }
  enterSite?.addEventListener('click', () => {
    localStorage.setItem('missDebrahAgeOk', 'true');
    ageGate.hidden = true;
    document.body.classList.remove('is-locked');
  });

  const header = document.querySelector('[data-header]');
  const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const toggle = document.querySelector('.nav__toggle');
  const menu = document.getElementById('navMenu');
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    menu?.classList.toggle('is-open', !open);
  });
  menu?.addEventListener('click', (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      toggle?.setAttribute('aria-expanded', 'false');
      menu.classList.remove('is-open');
    }
  });

  if (!prefersReduced && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
  } else {
    document.querySelectorAll('.reveal').forEach((element) => element.classList.add('is-visible'));
  }

  document.querySelectorAll('[data-accordion] .accordion__trigger').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const panel = trigger.nextElementSibling;
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', String(!expanded));
      if (panel) panel.hidden = expanded;
    });
  });

  const lightbox = document.getElementById('lightbox');
  const lightboxImage = lightbox?.querySelector('img');
  const closeLightbox = lightbox?.querySelector('.lightbox__close');
  let lastGalleryButton = null;
  document.querySelectorAll('.gallery-item').forEach((button) => {
    button.addEventListener('click', () => {
      const full = button.getAttribute('data-full');
      const img = button.querySelector('img');
      if (!full || !lightbox || !lightboxImage) return;
      lastGalleryButton = button;
      lightboxImage.src = full;
      lightboxImage.alt = img?.alt || 'Expanded gallery image';
      lightbox.hidden = false;
      document.body.classList.add('is-locked');
      closeLightbox?.focus();
    });
  });
  const close = () => {
    if (!lightbox || !lightboxImage) return;
    lightbox.hidden = true;
    lightboxImage.src = '';
    document.body.classList.remove('is-locked');
    lastGalleryButton?.focus();
  };
  closeLightbox?.addEventListener('click', close);
  lightbox?.addEventListener('click', (event) => { if (event.target === lightbox) close(); });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && lightbox && !lightbox.hidden) close();
  });

  const form = document.getElementById('bookingForm');
  const status = document.getElementById('formStatus');
  const output = document.getElementById('copyOutput');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get('clientName') || '');
    const dateTime = String(data.get('dateTime') || '');
    const duration = String(data.get('duration') || '1 hour');
    const details = String(data.get('details') || '');
    const message = [
      `Hello Miss Debrah, my name is ${name || '[your name]'}.`,
      `I would like to ask about your availability for ${dateTime || '[preferred date/time]'} for ${duration}.`,
      details ? `Helpful context: ${details}` : 'Helpful context: [incall/outcall preference, timing notes, and anything relevant to fit or boundaries].',
      'I value discretion, punctuality, and clear communication. Thank you.'
    ].join('\n');
    output.hidden = false;
    output.value = message;
    output.focus();
    output.select();
    try {
      await navigator.clipboard.writeText(message);
      status.textContent = 'Message created and copied to your clipboard.';
    } catch {
      status.textContent = 'Message created. Copy it from the field below.';
    }
  });
})();
