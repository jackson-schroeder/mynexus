// First-launch tour: asks once whether you'd like a walkthrough of what everything does. Replayable from mySettings or search.
const Tour = (() => {
  const KEY = 'nx.tour';
  const STEPS = [
    ['Dashboard', 'myDashboard', "Your home base: today's calendar, recent activity, your fitness and your tasks at a glance. Tap any card to jump to it."],
    ['Fitness/Lifting', 'myLifting', 'Log workouts with + Log workout or a single exercise with + Log exercise. See your streak, personal records and which muscles you are training. Lift stats (below) charts your progress per exercise.'],
    ['Fitness/Running', 'myRunning', 'Your runs, pace and weekly miles, with a weekly goal.'],
    ['Fitness/Diet', 'myDiet', 'Log meals from over 1,300 foods, build smoothies, save your own meals and see your nutrients against your goals. Hit every goal within 10% to keep your streak.'],
    ['Time/Todo', 'myTodo', 'Add tasks as Today, This Week or Anytime. See what is most urgent and track your progress with the rings.'],
    ['Time/Calendar', 'myCalendar', 'A calendar of your own: events, and any task with a date shows up too. Tap a day to see its timeline.'],
    ['Projects', 'myProjects', 'Boards you share with friends: steps and cards, a timeline of phases, and an updates chat for the group.'],
    ['Settings', 'mySettings', 'Your account, which tabs you want to see, example data on/off, and a reset button. You can replay this tour from here any time.']
  ];
  const title = n => `<span class="my">my</span><span class="nm">${n.replace(/^my/, '')}</span>`;
  let el = null, i = -1;
  const close = () => { el?.remove(); el = null; i = -1; };
  const done = () => { try { localStorage.setItem(KEY, '1'); } catch {} try { Personal.setPrefs({ tourDone: true }); } catch {} close(); go('Dashboard'); };

  function draw() {
    if (!el) { el = document.createElement('div'); el.className = 'tour'; document.body.appendChild(el); }
    if (i < 0) {
      el.innerHTML = `<div class="tile tour-card tour-ask"><h3>Welcome to ${title('myNexus')}</h3><p class="p">Want a quick tour? It shows what everything does and takes about a minute.</p>
        <div class="pj-row"><button class="tile pj-btn primary" data-tour-act="next">Show me around</button><button class="tile pj-btn" data-tour-act="skip">No, I'm good</button></div></div>`;
      return;
    }
    const [path, name, text] = STEPS[i], last = i === STEPS.length - 1;
    el.innerHTML = `<div class="tile tour-card"><div class="p">${i + 1} of ${STEPS.length}</div><h3>${title(name)}</h3><p class="it">${text}</p>
      <div class="pj-row"><button class="tile pj-btn" data-tour-act="back" ${i ? '' : 'disabled'}>Back</button><span class="pj-spacer"></span>
      <button class="tile pj-btn" data-tour-act="skip">${last ? 'Close' : 'Skip tour'}</button><button class="tile pj-btn primary" data-tour-act="next">${last ? 'Finish' : 'Next'}</button></div></div>`;
    go(path);
  }

  function start() { i = -1; draw(); }
  document.addEventListener('click', e => {
    if (e.target.closest('[data-tour]')) { start(); return; }
    const b = e.target.closest('[data-tour-act]');
    if (!b) return;
    const a = b.dataset.tourAct;
    if (a === 'skip') done();
    else if (a === 'back') { i = Math.max(0, i - 1); draw(); }
    else if (i === STEPS.length - 1) done();
    else { i++; draw(); }
  });

  // First launch: once signed in (and your saved settings have had a moment to arrive), offer the tour
  let offered = false;
  function maybeOffer() {
    if (offered || !Store.me || el) return;
    let seen = false; try { seen = !!localStorage.getItem(KEY); } catch {}
    if (seen) { offered = true; return; }
    offered = true;
    setTimeout(() => { if (Personal.prefs.tourDone) { try { localStorage.setItem(KEY, '1'); } catch {} } else start(); }, 3000);
  }
  Store.subscribe(maybeOffer); maybeOffer();
  return { start };
})();
