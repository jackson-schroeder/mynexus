// mySettings: Account card + Tabs card.
// Account: one myNexus account (Supabase) for everything — myProjects, myTodo, myCalendar, myRecents.
const Account = (() => {
  let root = null, mode = 'in', email = '', resetAsk = false;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function mount(el) {
    if (root !== el) { root = el; root.innerHTML = '<div class="set-wrap"><div id="acBox"></div><div id="tabsBox"></div></div>'; bind(); }
    render(); renderTabs();
  }
  const refresh = () => { if (root && !root.hidden && !root.contains(document.activeElement)) { render(); renderTabs(); } };
  const box = () => root.querySelector('#acBox');
  Store.subscribe(refresh);
  Personal.subscribe(refresh);

  async function loadEmail() {
    const { data } = await Store.client.auth.getSession();
    email = data.session?.user?.email || '';
    root.querySelector('#acEmail') && (root.querySelector('#acEmail').textContent = email);
  }

  function render() {
    const me = Store.me;
    if (!Store.cloud) { box().innerHTML = `<div class="surface ac-card"><h2>Account</h2><p class="p">Add your Supabase details in js/config.js to turn on accounts.</p></div>`; return; }
    if (!me) {
      box().innerHTML = `<div class="surface ac-card">
        <div class="ac-hero"><div class="ac-orb"></div><div><h2><span class="my">my</span><span class="nm">Account</span></h2>
          <p class="p">Sign in once and everything — projects, tasks, calendar and recents — is saved to your account and follows you to your phone.</p></div></div>
        <div class="td-seg ac-tabs"><button class="${mode === 'in' ? 'on' : ''}" data-mode="in">Sign in</button><button class="${mode === 'up' ? 'on' : ''}" data-mode="up">Create account</button></div>
        ${mode === 'up' ? `<input class="pj-in" id="acUser" placeholder="Username (letters, numbers, _)">` : ''}
        <input class="pj-in" id="acEmailIn" type="email" placeholder="Email">
        <div class="pw-wrap"><input class="pj-in" id="acPass" type="password" placeholder="Password (6+ characters)"><button type="button" class="pw-eye" data-eye aria-label="Show password"></button></div>
        ${mode === 'up' ? `<div class="pw-wrap"><input class="pj-in" id="acPass2" type="password" placeholder="Type your password again"><button type="button" class="pw-eye" data-eye aria-label="Show password"></button></div>` : ''}
        <button class="tile pj-btn primary" data-go-auth>${mode === 'up' ? 'Create account' : 'Sign in'}</button>
        ${mode === 'in' ? AuthFlow.html() : ''}
        <div class="pj-err" id="acErr">${Store.ready ? '' : 'The cloud database isn\'t set up yet. Run supabase/schema.sql in Supabase first.'}</div>
        <p class="p">Anything already on this computer is uploaded to your account the first time you sign in.</p></div>`;
      return;
    }
    const st = [
      ['Projects', Store.status === 'online' ? 'Synced' : Store.status === 'syncing' ? 'Syncing…' : 'Offline — will sync', Store.status === 'online'],
      ['Tasks, calendar & recents', Personal.cloudMissing ? 'Needs setup: run supabase/personal.sql' : Personal.pending ? `Syncing ${Personal.pending} change${Personal.pending === 1 ? '' : 's'}…` : navigator.onLine ? 'Synced' : 'Offline — will sync', !Personal.cloudMissing && !Personal.pending && navigator.onLine]
    ];
    box().innerHTML = `<div class="surface ac-card">
      <div class="ac-hero"><div class="ac-av">${esc(Store.initials(me.username))}</div>
        <div><h2>@${esc(me.username)}</h2><div class="p" id="acEmail">${esc(email)}</div></div></div>
      <div class="ac-sync">${st.map(([l, v, ok]) => `<div class="tile ac-row"><span class="ac-dot${ok ? ' ok' : ''}"></span><div><div class="it">${l}</div><div class="p">${v}</div></div></div>`).join('')}</div>
      <div class="pj-row"><span class="p">Signed in on this computer. Use the same email and password on your phone.</span><span class="pj-spacer"></span><button class="tile pj-btn" data-signout>Sign out</button></div>
      ${resetAsk ? `<div class="ac-danger"><p class="p">This permanently deletes ALL your tasks, calendar, fitness and diet logs, settings and every project you own (your friends lose those projects too). It can't be undone. Type <b>RESET</b> to confirm.</p><div class="pj-row"><input class="pj-in" id="acResetIn" placeholder="RESET" autocomplete="off"><button class="tile pj-btn danger" data-reset-go>Delete everything</button><button class="tile pj-btn" data-reset-cancel>Cancel</button></div><div class="pj-err" id="acResetErr"></div></div>` : `<div class="pj-row"><span class="p">Start over with a clean account.</span><span class="pj-spacer"></span><button class="tile pj-btn danger" data-reset-ask>Reset all my data</button></div>`}
    </div>`;
    if (!email) loadEmail();
  }

  // Tabs: hide any tab (and its dashboard card) you don't use; turn it back on anytime
  const TABS = [['Fitness', ['Lifting', 'Running', 'Diet']], ['Time', ['Todo', 'Calendar', 'Goals', 'Time']], ['Projects', []], ['Finance', []]];
  const tgl = (path, on, label, sub) => `<label class="pj-perm set-tab${sub ? ' sub' : ''}"><input type="checkbox" data-tabtoggle="${path}" ${on ? 'checked' : ''}><span class="pj-toggle"></span><span><span class="my">my</span><span class="nm">${label}</span></span></label>`;
  function renderTabs() {
    const hidden = Personal.prefs.hidden || [];
    root.querySelector('#tabsBox').innerHTML = `<div class="surface ac-card">
      <h2><span class="my">my</span><span class="nm">Tabs</span></h2>
      <p class="p">Turn off anything you don't use. It disappears from the sidebar and dashboard, and your data stays saved.</p>
      <div class="set-tabs">${TABS.map(([t, subs]) => `<div class="tile set-group">${tgl(t, !hidden.includes(t), t)}
        ${subs.length ? `<div class="set-subs${hidden.includes(t) ? ' off' : ''}">${subs.map(sb => tgl(t + '/' + sb, !hidden.includes(t + '/' + sb), sb, true)).join('')}</div>` : ''}</div>`).join('')}</div></div>
      <div class="surface ac-card"><h2><span class="my">my</span><span class="nm">Demo</span></h2>
        <p class="p">Show example data anywhere you haven't logged anything yet. It's never saved to your account, and it disappears for a feature as soon as you add something real.</p>
        <label class="pj-perm set-tab"><input type="checkbox" data-demotoggle ${Personal.demoOn ? 'checked' : ''}><span class="pj-toggle"></span>Show demo data</label></div>`;
  }

  function bind() {
    root.addEventListener('change', e => {
      if ('demotoggle' in e.target.dataset) { Personal.setPrefs({ demo: e.target.checked }); e.target.blur(); return; }
      const p = e.target.dataset.tabtoggle;
      if (!p) return;
      const h = new Set(Personal.prefs.hidden || []);
      e.target.checked ? h.delete(p) : h.add(p);
      Personal.setPrefs({ hidden: [...h] });
      e.target.blur();
    });
    root.addEventListener('click', async e => {
      const t = e.target.closest('[data-mode],[data-go-auth],[data-signout],[data-reset-ask],[data-reset-go],[data-reset-cancel]');
      if (!t) return;
      if (t.dataset.mode) { mode = t.dataset.mode; render(); }
      else if ('signout' in t.dataset) { email = ''; await Store.signOut(); }
      else if ('resetAsk' in t.dataset) { resetAsk = true; render(); }
      else if ('resetCancel' in t.dataset) { resetAsk = false; render(); }
      else if ('resetGo' in t.dataset) {
        const err = root.querySelector('#acResetErr');
        if (root.querySelector('#acResetIn').value.trim() !== 'RESET') { err.textContent = 'Type RESET (capitals) to confirm.'; return; }
        err.textContent = 'Deleting…';
        const msg = await Store.resetEverything();
        if (msg) { err.textContent = msg; return; }
        resetAsk = false; render(); renderTabs();
      }
      else {
        const err = root.querySelector('#acErr'); err.textContent = '…';
        const em = root.querySelector('#acEmailIn').value.trim(), pw = root.querySelector('#acPass').value;
        if (mode === 'up' && pw !== root.querySelector('#acPass2').value) { err.textContent = "Passwords don't match"; return; }
        const msg = mode === 'up' ? await Store.signUp(em, pw, root.querySelector('#acUser').value.trim()) : await Store.signIn(em, pw);
        if (msg) { const el = root.querySelector('#acErr'); if (el) el.textContent = msg; } else render();
      }
    });
    root.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.pj-in') && !e.target.closest('.af')) root.querySelector('[data-go-auth]')?.click(); });
  }
  return { mount };
})();
