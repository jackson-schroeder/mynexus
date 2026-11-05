// Fit check (developer tool): `await fitAudit(['Time/Calendar'])` checks only the pages you name (the areas a change touched);
// `await fitAudit()` checks every page. Reports anything cut off.
// Rule: nothing may ever be clipped. Run it at 900px tall and widths 1280 / 1440 / 1600 (the app's canvas range).
// Modes covered: full screen + windowed, demo data on + off, and both pages of myLifting.
async function fitAudit(only) {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const name = el => (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : el.tagName.toLowerCase());
  const freeze = document.createElement('style');
  freeze.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
  document.head.appendChild(freeze);
  const check = () => {
    const out = [], panel = document.querySelector('.panel');
    if (panel.scrollHeight > panel.clientHeight + 2) out.push(`panel overflows ${panel.scrollHeight - panel.clientHeight}px`);
    document.querySelectorAll('.panel *').forEach(el => {
      if ((!el.offsetParent && el.tagName !== 'svg') || el.matches('.lg-pages, .lg-track')) return;
      const cs = getComputedStyle(el);
      if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) return out.push(`text cut: ${name(el)} "${el.textContent.trim().slice(0, 30)}"`);
      if (/hidden|clip/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2) out.push(`cut ${el.scrollHeight - el.clientHeight}px tall: ${name(el)}`);
      if (/hidden|clip/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2) out.push(`cut ${el.scrollWidth - el.clientWidth}px wide: ${name(el)}`);
    });
    return [...new Set(out)];
  };
  const all = ['Dashboard', 'Fitness/Lifting', 'Fitness/Running', 'Fitness/Diet', 'Time/Todo', 'Time/Calendar', 'Time/Notes', 'Time/Goals', 'Time/Time', 'Projects', 'Finance', 'Settings'];
  const pages = only ? all.filter(p => only.includes(p)) : all, stats = !only || only.includes('Lift stats'), dhist = !only || only.includes('Diet history');
  const was = { page: current, demo: Personal.demoOn, app: document.body.classList.contains('app'), windowed: document.body.classList.contains('windowed') };
  const report = {};
  for (const demo of [true, false]) {
    Personal.setPrefs({ demo });
    for (const windowed of [false, true]) {
      document.body.classList.toggle('app', windowed || was.app);
      document.body.classList.toggle('windowed', windowed);
      const run = async label => { await wait(90); fitLists(); const r = check(); if (r.length) report[`${innerWidth}x${innerHeight} ${windowed ? 'windowed' : 'full'} ${demo ? 'demo' : 'empty'} · ${label}`] = r; };
      for (const p of pages) { go(p); await run(p); }
      if (stats) {
        go('Fitness/Lifting'); await wait(60);
        const track = document.querySelector('#liftRoot .lg-track');
        track.style.transform = 'translateY(-100%)'; await run('Lift stats'); track.style.transform = '';
      }
      if (dhist) {
        go('Fitness/Diet'); await wait(60);
        const track = document.querySelector('#dietRoot .lg-track');
        track.style.transform = 'translateY(-100%)'; await run('Diet history'); track.style.transform = '';
      }
    }
  }
  Personal.setPrefs({ demo: was.demo });
  document.body.classList.toggle('app', was.app); document.body.classList.toggle('windowed', was.windowed);
  freeze.remove(); go(was.page);
  return Object.keys(report).length ? report : `All clear at ${innerWidth}x${innerHeight}: ${pages.length + (stats ? 1 : 0) + (dhist ? 1 : 0)} page(s) × full/windowed × demo on/off`;
}
