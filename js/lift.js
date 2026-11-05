// Shared by myNexus and the standalone myProjects app.

// Window controls (Electron only)
if (window.nexus) {
  document.body.classList.add('app');
  nexus.onState(full => document.body.classList.toggle('windowed', !full));
}

// Phone layout: narrow screens (the installed phone app) get html.phone; the desktop app never does.
const phoneMQ = matchMedia('(max-width: 820px)');
const isPhone = () => document.documentElement.classList.contains('phone');
const setPhone = () => document.documentElement.classList.toggle('phone', phoneMQ.matches && !window.nexus);
setPhone(); phoneMQ.addEventListener('change', () => { setPhone(); queueFit(); });

// Hover lift: every element grows by the same fixed px (--lift-px) on each side, whatever its size.
// New elements are sized automatically as they appear.
const LIFT = '.tile, .search';
function sizeLifts() {
  const px = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lift-px')) || 12;
  document.querySelectorAll(LIFT).forEach(el => { if (el.offsetWidth) el.style.setProperty('--s', 1 + 2 * px / el.offsetWidth); });
}
let liftQueued = false;
const queueLifts = () => { if (!liftQueued) { liftQueued = true; requestAnimationFrame(() => { liftQueued = false; sizeLifts(); }); } };
new MutationObserver(queueLifts).observe(document.body, { childList: true, subtree: true });
addEventListener('resize', queueLifts);
queueLifts();

// Password fields: the eye button shows/hides what you typed
document.addEventListener('click', e => {
  const b = e.target.closest('[data-eye]');
  if (!b) return;
  const inp = b.previousElementSibling, show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  b.classList.toggle('on', show);
  b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  inp.focus();
});

// Fit lists: a list marked data-fit shows only the rows that fully fit its space (never a half-cut row).
// Runs after anything on the page changes and when the window resizes.
function fitLists() {
  if (isPhone()) { document.querySelectorAll('[data-fit] > [hidden]').forEach(r => (r.hidden = false)); document.querySelectorAll('.fit-more').forEach(m => (m.hidden = true)); return; } // phone pages scroll, so nothing is hidden
  document.querySelectorAll('[data-fit]').forEach(list => {
    if (!list.offsetParent) return;
    [...list.children].forEach(r => (r.hidden = false));
    const rows = [...list.children];
    const head = list.previousElementSibling?.classList.contains('tm-gh') ? list.previousElementSibling : null;
    if (head) head.hidden = false;
    const min = list.hasAttribute('data-fit-optional') ? 0 : 1; // optional lists may hide entirely
    for (let i = rows.length - 1; i >= min && list.scrollHeight > list.clientHeight + 1; i--) rows[i].hidden = true;
    if (head && rows.every(r => r.hidden)) head.hidden = true;
    // a '+N' badge next to the list (e.g. calendar cells) counts the rows that didn't fit
    const more = list.parentElement?.querySelector('.fit-more');
    if (more) { const n = rows.filter(r => r.hidden).length; more.textContent = '+' + n; more.hidden = !n; }
  });
}
let fitQueued = false;
const queueFit = () => { if (!fitQueued) { fitQueued = true; requestAnimationFrame(() => { fitQueued = false; fitLists(); }); } };
// (ignores the row show/hide that fitLists itself does, so it can't loop)
new MutationObserver(m => { if (m.some(x => x.type === 'childList' || !x.target.parentElement?.hasAttribute('data-fit'))) queueFit(); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
addEventListener('resize', queueFit);
