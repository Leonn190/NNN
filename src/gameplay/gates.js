(() => {
'use strict';

const { OFFICE, VENUE } = window.NathGame;
const gateIds = new Set(VENUE.openings.filter(({ type }) => type === 'portao').map(({ id }) => id));
const canControlGate = (id, source, blackout) => id !== OFFICE.gate || (source !== 'cameras' && !blackout);

function createGates(limit, changed, initial = []) {
  const closed = new Set([...initial].filter(id => gateIds.has(id)).slice(0, limit));

  function open(id) {
    if (!closed.delete(id)) return false;
    changed([{ id, closed: false }]);
    return true;
  }

  function toggle(id, source, blackout) {
    if (!gateIds.has(id) || limit <= 0 || !canControlGate(id, source, blackout)) return false;
    if (closed.has(id)) return open(id);
    const changes = [];
    if (closed.size >= limit) {
      const reopened = [...closed].at(-1);
      closed.delete(reopened);
      changes.push({ id: reopened, closed: false });
    }
    closed.add(id);
    changed([...changes, { id, closed: true }]);
    return true;
  }

  return { closed, open, toggle };
}

Object.assign(window.NathGame, { createGates, canControlGate });
})();
