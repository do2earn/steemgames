/* Keep the preloader visible until the page-specific content is ready. */
(() => {
  const overlay = document.getElementById('sg-preloader');
  if (!overlay) return;
  const fill = overlay.querySelector('.sg-preloader-progress-fill');
  const percent = overlay.querySelector('.sg-preloader-percent');
  const bar = overlay.querySelector('[role="progressbar"]');
  let value = 0, finished = false, timer, safetyTimer;
  const paint = next => {
    value = Math.max(value, Math.min(100, Math.round(next)));
    if (fill) fill.style.width = value + '%';
    if (percent) percent.textContent = value + '%';
    if (bar) bar.setAttribute('aria-valuenow', String(value));
  };
  const advance = () => {
    if (finished || value >= 92) return;
    paint(Math.min(92, value + Math.max(1, (92 - value) * .09)));
    timer = window.setTimeout(advance, 220);
  };
  const hide = () => {
    if (finished) return;
    finished = true;
    window.clearTimeout(timer);
    window.clearTimeout(safetyTimer);
    paint(100);
    window.setTimeout(() => {
      overlay.classList.add('is-hidden');
      window.setTimeout(() => overlay.remove(), 450);
    }, 180);
  };
  if (document.documentElement.dataset.sgPageReady === 'true') {
    hide();
  } else {
    paint(3);
    timer = window.setTimeout(advance, 160);
    window.addEventListener('sgPageReady', hide, { once: true });
    window.addEventListener('pageshow', event => {
      if (event.persisted) hide();
    }, { once: true });
    // Final fallback if a third-party resource or page script never responds.
    safetyTimer = window.setTimeout(hide, 30000);
  }
})();