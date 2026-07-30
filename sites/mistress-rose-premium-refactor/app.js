(() => {
  const body = document.body;
  const ageGate = document.getElementById('age-gate');
  const ageEnter = document.getElementById('age-enter');
  const ageKey = 'missDebrahRoseRefactorAgeConfirmed';

  const openAgeGate = () => {
    ageGate.hidden = false;
    body.classList.add('is-locked');
    requestAnimationFrame(() => ageEnter.focus());
  };
  const closeAgeGate = () => {
    localStorage.setItem(ageKey, 'yes');
    ageGate.hidden = true;
    body.classList.remove('is-locked');
    document.getElementById('main').focus({ preventScroll: true });
  };
  if (localStorage.getItem(ageKey) === 'yes') {
    ageGate.hidden = true;
    body.classList.remove('is-locked');
  } else {
    openAgeGate();
  }
  ageEnter.addEventListener('click', closeAgeGate);
  ageGate.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusable = [...ageGate.querySelectorAll('button, a[href]')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.getElementById('primary-nav');
  const closeMenu = () => {
    nav.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.querySelector('.sr-only').textContent = 'Open menu';
  };
  menuButton.addEventListener('click', () => {
    const opening = menuButton.getAttribute('aria-expanded') === 'false';
    nav.classList.toggle('is-open', opening);
    menuButton.setAttribute('aria-expanded', String(opening));
    menuButton.querySelector('.sr-only').textContent = opening ? 'Close menu' : 'Open menu';
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) { closeMenu(); menuButton.focus(); }
  });

  document.querySelectorAll('.faq-trigger').forEach(button => {
    button.addEventListener('click', () => {
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      const willOpen = button.getAttribute('aria-expanded') === 'false';
      button.setAttribute('aria-expanded', String(willOpen));
      panel.hidden = !willOpen;
    });
  });

  const galleryItems = [...document.querySelectorAll('[data-gallery-item]')];
  const lightbox = document.getElementById('lightbox');
  const lightboxImage = lightbox.querySelector('img');
  const lightboxTitle = document.getElementById('lightbox-title');
  let activeGalleryIndex = 0;
  let lastGalleryTrigger = null;
  const showGalleryImage = index => {
    activeGalleryIndex = (index + galleryItems.length) % galleryItems.length;
    const source = galleryItems[activeGalleryIndex].querySelector('img');
    lightboxImage.src = source.src;
    lightboxImage.alt = source.alt;
    lightboxTitle.textContent = galleryItems[activeGalleryIndex].querySelector('span').textContent;
  };
  galleryItems.forEach((item, index) => item.addEventListener('click', () => {
    lastGalleryTrigger = item;
    showGalleryImage(index);
    lightbox.showModal();
  }));
  lightbox.querySelector('[data-lightbox-prev]').addEventListener('click', () => showGalleryImage(activeGalleryIndex - 1));
  lightbox.querySelector('[data-lightbox-next]').addEventListener('click', () => showGalleryImage(activeGalleryIndex + 1));
  lightbox.querySelector('[data-close-lightbox]').addEventListener('click', () => lightbox.close());
  lightbox.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });
  lightbox.addEventListener('close', () => lastGalleryTrigger?.focus());

  const legalDialog = document.getElementById('legal-dialog');
  const legalTitle = document.getElementById('legal-title');
  const legalCopy = document.getElementById('legal-copy');
  const legalContent = {
    privacy: ['Privacy', '<p>This portfolio preview does not transmit, store, or share information entered into its demonstration form.</p><p>A production contact service should publish its data controller, retention period, secure processing provider, and deletion-request method before accepting enquiries.</p>'],
    terms: ['Terms', '<p>This preview is intended for adults aged 18 and over. Content is informational and does not constitute an offer or confirmation of an appointment.</p><p>Consent, lawful conduct, mutual privacy, and professional boundaries are required at every stage.</p>']
  };
  document.querySelectorAll('[data-legal]').forEach(button => button.addEventListener('click', () => {
    const [title, copy] = legalContent[button.dataset.legal];
    legalTitle.textContent = title;
    legalCopy.innerHTML = copy;
    legalDialog.showModal();
  }));
  legalDialog.querySelector('[data-close-legal]').addEventListener('click', () => legalDialog.close());
  legalDialog.addEventListener('click', event => { if (event.target === legalDialog) legalDialog.close(); });

  const form = document.getElementById('consultation-form');
  const status = document.getElementById('form-status');
  const submit = form.querySelector('[type="submit"]');
  const getError = field => {
    if (field.validity.valueMissing) return field.type === 'checkbox' ? 'Confirmation is required.' : 'This field is required.';
    if (field.validity.typeMismatch) return 'Enter a valid email address.';
    if (field.validity.tooShort) return `Please use at least ${field.minLength} characters.`;
    return '';
  };
  const showFieldError = field => {
    const error = document.getElementById(`${field.id}-error`);
    const message = getError(field);
    field.setAttribute('aria-invalid', String(Boolean(message)));
    if (error) error.textContent = message;
    return !message;
  };
  form.querySelectorAll('input[required], select[required], textarea[required]').forEach(field => {
    field.addEventListener('blur', () => showFieldError(field));
    field.addEventListener('input', () => { if (field.getAttribute('aria-invalid') === 'true') showFieldError(field); });
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    status.textContent = '';
    const fields = [...form.querySelectorAll('input[required], select[required], textarea[required]')];
    const valid = fields.map(showFieldError).every(Boolean);
    if (!valid) {
      const firstInvalid = form.querySelector('[aria-invalid="true"]');
      status.textContent = 'Please review the highlighted fields.';
      firstInvalid?.focus();
      return;
    }
    submit.disabled = true;
    submit.classList.add('is-loading');
    submit.querySelector('span').textContent = 'Preparing request';
    window.setTimeout(() => {
      submit.disabled = false;
      submit.classList.remove('is-loading');
      submit.querySelector('span').textContent = 'Request a consultation';
      status.textContent = 'Your introduction is ready. This portfolio demo did not transmit or store it.';
      status.focus();
      form.reset();
      fields.forEach(field => field.removeAttribute('aria-invalid'));
    }, 650);
  });

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveals = document.querySelectorAll('.reveal');
  if (reducedMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(item => item.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), { threshold: .12 });
    reveals.forEach(item => observer.observe(item));
  }
  document.getElementById('year').textContent = new Date().getFullYear();
})();
