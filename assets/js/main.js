(function() {
  // Current year in footer
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // Reduce motion respect
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReduced) {
    // Subtle reveal on scroll
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if(e.isIntersecting){ e.target.classList.add('show'); io.unobserve(e.target); }
      })
    }, { threshold: 0.1 });
    els.forEach(el=>io.observe(el));
  }
})();