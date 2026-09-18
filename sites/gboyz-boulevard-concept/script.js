const toggle = document.querySelector('[data-menu-toggle]');
const nav = document.querySelector('[data-nav]');
const ticker = document.querySelector('.marquee-track');

if (ticker && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  ticker.innerHTML = `${ticker.innerHTML}${ticker.innerHTML}`;
}

function closeMenu() {
  toggle?.setAttribute('aria-expanded', 'false');
  nav?.classList.remove('is-open');
  document.body.classList.remove('nav-open');
}

toggle?.addEventListener('click', () => {
  const isOpen = toggle.getAttribute('aria-expanded') === 'true';
  toggle.setAttribute('aria-expanded', String(!isOpen));
  nav?.classList.toggle('is-open', !isOpen);
  document.body.classList.toggle('nav-open', !isOpen);
});

nav?.addEventListener('click', (event) => {
  if (event.target instanceof HTMLAnchorElement) closeMenu();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});
