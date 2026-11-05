// Cards on your calendar: a project card you place on a day becomes a task linked to that card.
// Completing one completes the other everywhere (task list, calendar, cards table): "done" = the card sits in the project's last step.
const CardLink = (() => {
  const KEY = 'card.links';
  const get = () => Personal.getKv(KEY, []) || [];
  const set = l => Personal.setKv(KEY, l);
  const forCard = cid => get().find(l => l.cardId === cid);
  const forTask = tid => get().find(l => l.taskId === tid);
  const realTask = id => Personal.tasks.find(t => t.id === id);
  const lastStep = pid => Store.steps(pid).slice(-1)[0], firstStep = pid => Store.steps(pid)[0];
  const cardDone = c => !!c && lastStep(c.project_id)?.id === c.step_id;

  // Complete / reopen a card by moving it to the last / first step
  function setCardDone(cardId, done) {
    const c = Store.get('cards', cardId); if (!c || cardDone(c) === done) return;
    const st = done ? lastStep(c.project_id) : firstStep(c.project_id);
    if (!st || st.id === c.step_id) return;
    Store.moveCard(c.id, st.id, Store.cards(st.id).length);
    Store.note(c.project_id, `${done ? 'completed' : 'reopened'} “${c.title}”`);
  }

  // Put a card on a day (creates the linked task, or moves it if the card is already on the calendar)
  function place(cardId, day) {
    const c = Store.get('cards', cardId); if (!c) return;
    const l = forCard(cardId), existing = l && realTask(l.taskId);
    if (existing) { Personal.updateTask(existing.id, { date: day }); return existing; }
    const done = cardDone(c), t = Personal.addTask({ title: c.title, date: day, notes: 'From myProjects · ' + (Store.get('projects', c.project_id)?.name || ''), done, doneAt: done ? Date.now() : null });
    set([...get().filter(x => x.cardId !== cardId && x.taskId !== t.id), { taskId: t.id, cardId, projectId: c.project_id }]);
    return t;
  }

  // A linked task was checked / unchecked: do the same to its card
  function taskChanged(taskId) {
    const l = forTask(taskId); if (!l) return;
    const t = realTask(taskId); if (t) setCardDone(l.cardId, !!t.done);
  }
  const taskRemoved = taskId => { if (forTask(taskId)) set(get().filter(l => l.taskId !== taskId)); };

  // A card moved (or was deleted): bring its task in line
  function sync() {
    if (!Store.me) return;
    let links = get(), changed = false;
    links.forEach(l => {
      const c = Store.get('cards', l.cardId), t = realTask(l.taskId);
      if (!t) return;
      if (!c) { if (Store.get('projects', l.projectId)) { links = links.filter(x => x !== l); changed = true; } return; } // card was deleted: unlink, keep the task
      if (!!t.done !== cardDone(c)) Personal.updateTask(t.id, { done: cardDone(c), doneAt: cardDone(c) ? Date.now() : null });
    });
    if (changed) set(links);
  }
  Store.subscribe(sync);
  return { forCard, forTask, place, setCardDone, taskChanged, taskRemoved, cardDone };
})();
