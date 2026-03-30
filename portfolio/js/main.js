/* ============================================================
   ANJALI PATEL — PORTFOLIO SCRIPTS
   ============================================================ */

// ——————————————————————————————
// Navigation: scroll shadow
// ——————————————————————————————
(function () {
  const nav = document.querySelector('nav');
  if (!nav) return;

  const onScroll = () => {
    nav.classList.toggle('scrolled', window.scrollY > 16);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

// ——————————————————————————————
// Navigation: active link
// ——————————————————————————————
(function () {
  const path = window.location.pathname;
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href') || '';
    const isPlay = href.includes('play') && path.includes('play');
    const isWork =
      (href === 'index.html' || href === '/' || href.endsWith('/') || href.startsWith('#')) &&
      !path.includes('play');

    if (isPlay || isWork) {
      link.classList.add('active');
    }
  });
})();

// ——————————————————————————————
// Scroll-triggered reveal
// ——————————————————————————————
(function () {
  const sections = document.querySelectorAll('.case-section');
  if (!sections.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          // Stagger sibling elements if they share a parent reveal group
          entry.target.style.transitionDelay = '0s';
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px -48px 0px' }
  );

  sections.forEach(el => observer.observe(el));
})();

// ——————————————————————————————
// Smooth scroll: anchor links
// ——————————————————————————————
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 60;
    const top = target.getBoundingClientRect().top + window.scrollY - navH - 20;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

// ——————————————————————————————
// Back to top
// ——————————————————————————————
document.querySelectorAll('.back-top').forEach(btn => {
  btn.addEventListener('click', e => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

// ——————————————————————————————
// Impact counter animation
// ——————————————————————————————
(function () {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;

  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

  function animateCounter(el) {
    const raw = el.getAttribute('data-count');
    const suffix = el.getAttribute('data-suffix') || '';
    const prefix = el.getAttribute('data-prefix') || '';
    const target = parseFloat(raw);
    const isDecimal = raw.includes('.');
    const duration = 1800;
    const start = performance.now();

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const value = eased * target;
      const display = isDecimal ? value.toFixed(2) : Math.round(value);
      el.textContent = prefix + display + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  const obs = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  counters.forEach(el => obs.observe(el));
})();
