// Sign-in gate: the whole app stays behind a login. Once signed in you stay signed in (offline too)
// until you've been away 30 days in a row (see Store.start).
const Gate = (() => {
  if (!Store.cloud) return {};
  let mode = 'in';
  const el = document.createElement('div');
  el.id = 'gate'; el.className = 'gate'; el.hidden = true;
  document.body.appendChild(el);
  const eye = '<button type="button" class="pw-eye" data-eye aria-label="Show password"></button>';

  function render() {
    const up = mode === 'up';
    el.innerHTML = `<div class="tile pj-auth gate-card">
      <h2><span class="my">my</span><span class="nm">Nexus</span></h2>
      <p class="p">Sign in to open your app. You'll stay signed in until you've been away for 30 days.</p>
      <div class="pj-tabs"><button class="tile pj-btn${up ? '' : ' on'}" data-gate-mode="in">Sign in</button><button class="tile pj-btn${up ? ' on' : ''}" data-gate-mode="up">Create account</button></div>
      ${up ? '<input class="pj-in" id="gUser" data-at value="@" title="Username: 3-20 letters, numbers or _" autocomplete="username" autocapitalize="none">' : ''}
      <input class="pj-in" id="gEmail" type="email" placeholder="Email" autocomplete="email">
      <div class="pw-wrap"><input class="pj-in" id="gPass" type="password" placeholder="Password (6+ characters)" autocomplete="${up ? 'new-password' : 'current-password'}">${eye}</div>
      ${up ? `<div class="pw-wrap"><input class="pj-in" id="gPass2" type="password" placeholder="Type your password again" autocomplete="new-password">${eye}</div>` : ''}
      <button class="tile pj-btn primary" data-gate-go>${up ? 'Create account' : 'Sign in'}</button>
      ${up ? '' : AuthFlow.html()}
      <div class="pj-err" id="gErr"></div></div>`;
  }

  function sync() {
    const show = !Store.me;
    if (show && el.hidden) render();
    el.hidden = !show;
    document.body.classList.toggle('gated', show);
  }

  async function submit() {
    const v = id => el.querySelector(id)?.value.trim() ?? '', err = el.querySelector('#gErr');
    if (mode === 'up' && el.querySelector('#gPass').value !== el.querySelector('#gPass2').value) { err.textContent = "Passwords don't match"; return; }
    err.textContent = '…';
    const msg = mode === 'up' ? await Store.signUp(v('#gEmail'), el.querySelector('#gPass').value, v('#gUser')) : await Store.signIn(v('#gEmail'), el.querySelector('#gPass').value);
    if (msg && el.querySelector('#gErr')) el.querySelector('#gErr').textContent = msg;
  }

  el.addEventListener('click', e => {
    const m = e.target.closest('[data-gate-mode]');
    if (m) { mode = m.dataset.gateMode; render(); }
    else if (e.target.closest('[data-gate-go]')) submit();
  });
  el.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.target.closest('.af')) submit(); });
  Store.subscribe(sync);
  sync();
  return {};
})();
