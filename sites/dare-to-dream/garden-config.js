const gardenSections = [
  {
    id: 'first-light', label: 'First Light',
    still: 'assets/stills/scene-01.webp',
    clip: 'assets/video/scene-01.mp4',
    accent: '#F3C46B', scroll: 1.8, linger: 0.42,
    eyebrow: 'THE GARDEN AWAKENS',
    title: 'Wherever she flies, life follows.',
    body: 'Scroll to follow her.', tags: []
  },
  {
    id: 'blossom-path', label: 'Blossom Path',
    still: 'assets/stills/scene-02.webp',
    clip: 'assets/video/scene-02.mp4',
    accent: '#EA9DB7', scroll: 1.65, linger: 0.48,
    eyebrow: 'A LITTLE LIGHT', title: 'Changes everything.',
    body: 'Wonder begins with one small awakening.', tags: []
  },
  {
    id: 'crystal-stream', label: 'Crystal Stream',
    still: 'assets/stills/scene-03.webp',
    clip: 'assets/video/scene-03.mp4',
    accent: '#7299D8', scroll: 1.5, linger: 0.3,
    eyebrow: 'FOLLOW WHAT', title: 'Makes you feel alive.',
    body: 'Joy leaves ripples everywhere it goes.', tags: []
  },
  {
    id: 'heart-of-tree', label: 'Heart of the Tree',
    still: 'assets/stills/scene-04.webp',
    accent: '#A9DEC4', scroll: 1.7, linger: 0.5,
    eyebrow: 'GROWTH WAS', title: 'There all along.',
    body: 'Sometimes it only needs warmth, patience, and light.', tags: []
  },
  {
    id: 'sky-garden', label: 'Sky Garden',
    still: 'assets/stills/scene-05.webp',
    accent: '#B9A8DC', scroll: 1.55, linger: 0.32,
    eyebrow: 'THE WORLD IS', title: 'Wider than it looks.',
    body: 'Stay curious. Follow the light. Keep growing.', tags: []
  },
  {
    id: 'garden-awakened', label: 'Garden Awakened',
    still: 'assets/stills/scene-06.webp',
    accent: '#F3C46B', scroll: 1.95, linger: 0.55,
    eyebrow: 'LEAVE A LITTLE MAGIC', title: 'Wherever you go.',
    body: 'The world awakens one small act at a time.', tags: [],
    cta: {
      primary: { label: 'Begin Again', href: '#top' },
      secondary: { label: 'Share the Wonder', href: '#share' }
    }
  }
];

mountScrollWorld(document.getElementById('world'), {
  brand: { name: 'The Garden Awakens', href: '#top' },
  hint: 'scroll to follow her',
  nav: true,
  atmosphere: true,
  diveScroll: 1.45,
  connScroll: 0.8,
  crossfade: 0.08,
  sections: gardenSections,
  connectors: [
    'assets/video/connector-01.mp4',
    'assets/video/connector-02.mp4',
    null,
    null,
    null
  ]
});

document.addEventListener('click', async (event) => {
  const link = event.target.closest('a[href="#share"]');
  if (!link) return;
  event.preventDefault();
  const shareData = {
    title: 'The Garden Awakens',
    text: 'Wherever she flies, life follows.',
    url: window.location.href.split('#')[0]
  };
  if (navigator.share) await navigator.share(shareData).catch(() => {});
  else await navigator.clipboard?.writeText(shareData.url).catch(() => {});
});
