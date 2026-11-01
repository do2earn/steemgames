/* Real page-load progress with a short safety timeout. */
(() => {
  const overlay = document.getElementById('sg-preloader');
  if (!overlay) return;
  const fill = overlay.querySelector('.sg-preloader-progress-fill');
  const percent = overlay.querySelector('.sg-preloader-percent');
  const bar = overlay.querySelector('[role="progressbar"]');
  let value = 0, finished = false, timer;
  const paint = next => {
    value = Math.max(value, Math.min(100, Math.round(next)));
    fill.style.width = value + '%'; percent.textContent = value + '%';
    bar.setAttribute('aria-valuenow', String(value));
  };
  const advance = () => {
    if (finished || value >= 92) return;
    paint(Math.min(92, value + Math.max(1, (92 - value) * .12)));
    timer = window.setTimeout(advance, 180);
  };
  const hide = () => {
    if (finished) return;
    finished = true; window.clearTimeout(timer); paint(100);
    window.setTimeout(() => {
      overlay.classList.add('is-hidden');
      window.setTimeout(() => overlay.remove(), 450);
    }, 180);
  };
  if (document.readyState === 'complete') hide();
  else {
    timer = window.setTimeout(advance, 120);
    window.addEventListener('load', hide, {once:true});
    window.addEventListener('pageshow', event => { if (event.persisted) hide(); }, {once:true});
    window.setTimeout(hide, 15000);
  }
})();