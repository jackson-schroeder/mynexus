// Recycle bin: only projects and cards you delete on purpose land here, for 30 days. Saved in your account (user_kv).
const Bin = (() => {
  const KEY = 'bin', DAY = 864e5, KEEP = 30;
  const copy = o => JSON.parse(JSON.stringify(o));
  const fresh = () => (Personal.getKv(KEY, []) || []).filter(e => Date.now() - e.at < KEEP * DAY);
  const list = () => fresh().sort((a, b) => b.at - a.at);
  const put = entries => Personal.setKv(KEY, entries);
  const left = e => Math.max(0, Math.ceil(KEEP - (Date.now() - e.at) / DAY));

  function cardData(c) {
    return { cards: [copy(c)], comments: copy(Store.comments(c.id)), attachments: copy(Store.attachments(c.id)) };
  }
  function addCard(id) {
    const c = Store.get('cards', id), p = Store.get('projects', c.project_id);
    put([...fresh(), { id: crypto.randomUUID(), kind: 'card', name: c.title, at: Date.now(), projectId: c.project_id, projectName: p?.name || '', data: cardData(c) }]);
    Store.remove('cards', id);
  }
  function addProject(id) {
    const p = Store.get('projects', id), cards = Store.projectCards(id), data = {
      projects: [copy(p)], roles: copy(Store.roles(id)), members: copy(Store.members(id)), steps: copy(Store.steps(id)), cards: copy(cards),
      comments: cards.flatMap(c => copy(Store.comments(c.id))), attachments: cards.flatMap(c => copy(Store.attachments(c.id))),
      milestones: copy(Store.milestones(id)), updates: copy(Store.updates(id))
    };
    put([...fresh(), { id: crypto.randomUUID(), kind: 'project', name: p.name, at: Date.now(), data }]);
    Store.remove('projects', id);
  }
  // Put it back. Returns '' or a reason it couldn't.
  function restore(binId) {
    const e = fresh().find(x => x.id === binId);
    if (!e) return 'Already gone.';
    const d = e.data;
    if (e.kind === 'project') {
      if (Store.get('projects', d.projects[0].id)) return 'That project is already back.';
      ['projects', 'roles', 'members', 'steps', 'cards', 'comments', 'attachments', 'milestones', 'updates'].forEach(t => (d[t] || []).forEach(r => Store.insert(t, r)));
    } else {
      if (!Store.get('projects', e.projectId)) return 'Restore its project first (' + (e.projectName || 'deleted project') + ').';
      const card = copy(d.cards[0]);
      if (!Store.get('steps', card.step_id)) card.step_id = Store.steps(e.projectId)[0]?.id;
      if (!card.step_id) return 'That project has no steps to put the card in.';
      card.assignees = (card.assignees || []).filter(u => Store.members(e.projectId).some(m => m.user_id === u));
      Store.insert('cards', card);
      (d.comments || []).forEach(r => Store.insert('comments', r)); (d.attachments || []).forEach(r => Store.insert('attachments', r));
      Store.note(e.projectId, `restored card “${card.title}”`);
    }
    put(fresh().filter(x => x.id !== binId));
    return '';
  }
  const purge = binId => put(fresh().filter(x => x.id !== binId));
  return { list, left, addCard, addProject, restore, purge, get count() { return fresh().length; } };
})();
