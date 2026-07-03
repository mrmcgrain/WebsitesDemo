const toggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');
const filters = document.querySelectorAll('.filter');
const cards = document.querySelectorAll('.project-card');
const reveals = document.querySelectorAll('.reveal');

if (toggle && navLinks) {
  toggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}

filters.forEach((button) => {
  button.addEventListener('click', () => {
    filters.forEach((b) => b.classList.remove('active'));
    button.classList.add('active');
    const filter = button.dataset.filter;
    cards.forEach((card) => {
      const categories = card.dataset.category || '';
      const show = filter === 'all' || categories.includes(filter);
      card.style.display = show ? '' : 'none';
    });
  });
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

reveals.forEach((el) => observer.observe(el));
