// Forgot password + "email me a sign-in link", shared by the Account card and the myProjects sign-in.
// Supabase emails a one-time code (and link); the desktop app takes the code, so no web page is needed.
const AuthFlow = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const html = () => `<div class="af"><div class="af-links"><button type="button" class="af-link" data-af="forgot">Forgot password?</button><span class="af-sep">·</span><button type="button" class="af-link" data-af="link">Email me a sign-in link</button></div><div class="af-box"></div></div>`;
  const eye = '<button type="button" class="pw-eye" data-eye aria-label="Show password"></button>';

  const say = (box, msg, ok) => { let el = box.querySelector('.af-msg'); if (!el) box.insertAdjacentHTML('afterbegin', '<div class="af-msg"></div>'), el = box.querySelector('.af-msg'); el.textContent = msg; el.className = 'af-msg ' + (ok ? 'ok' : 'pj-err'); };

  async function start(af, mode) {
    const box = af.querySelector('.af-box'), email = af.parentElement.querySelector('input[type="email"]')?.value.trim();
    if (!email) { box.innerHTML = ''; say(box, 'Type your email above first.'); return; }
    say(box, 'Sending…', true);
    const msg = mode === 'forgot' ? await Store.requestReset(email) : await Store.requestCode(email);
    if (msg) { say(box, msg); return; }
    box.dataset.mode = mode; box.dataset.email = email;
    box.innerHTML = `<div class="p">We emailed <b>${esc(email)}</b>. Open it and type the code here${mode === 'forgot' ? ' with your new password' : ' to sign in'}. It's only good for a little while.</div>
      <input class="pj-in af-code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="Code from the email">
      ${mode === 'forgot' ? `<div class="pw-wrap"><input class="pj-in af-pass" type="password" placeholder="New password (6+ characters)">${eye}</div>` : ''}
      <div class="pj-row"><button type="button" class="tile pj-btn primary" data-af="verify">${mode === 'forgot' ? 'Set new password' : 'Sign in'}</button><button type="button" class="tile pj-btn" data-af="cancel">Cancel</button></div>`;
    box.querySelector('.af-code').focus();
  }

  async function verify(af) {
    const box = af.querySelector('.af-box'), { mode, email } = box.dataset, code = box.querySelector('.af-code').value.trim();
    if (!code) return say(box, 'Type the code from the email.');
    let msg;
    if (mode === 'forgot') {
      const pw = box.querySelector('.af-pass').value;
      if (pw.length < 6) return say(box, 'Password needs 6+ characters.');
      say(box, 'Working…', true); msg = await Store.resetPassword(email, code, pw);
    } else { say(box, 'Working…', true); msg = await Store.verifyCode(email, code); }
    if (msg) return say(box, msg);
    document.activeElement?.blur(); Store.kick(); // signed in: let the page redraw
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-af]'), af = t?.closest('.af');
    if (!af) return;
    const a = t.dataset.af;
    if (a === 'forgot' || a === 'link') start(af, a);
    else if (a === 'verify') verify(af);
    else if (a === 'cancel') af.querySelector('.af-box').innerHTML = '';
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.closest?.('.af-box')) { e.preventDefault(); e.stopPropagation(); e.target.closest('.af').querySelector('[data-af="verify"]')?.click(); }
  }, true);
  return { html };
})();
