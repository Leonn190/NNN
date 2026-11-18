(() => {
'use strict';

const KEY = 'nnn.campaigns.v2';
const STARS_KEY = 'nnn.stars.v1';
const LEGACY_PROGRESS = 'nnn.campaign.completed';

function createCampaignStore(storage = localStorage, totalNights = 9) {
  const read = key => {
    try { return storage.getItem(key); } catch { return null; }
  };
  const write = (key, value) => {
    try { storage.setItem(key, value); return true; } catch { return false; }
  };
  let stars = Math.max(0, (Number(read(STARS_KEY)) || 0) & 7);
  let data;
  try { data = JSON.parse(read(KEY)); } catch {}
  if (!data || data.version !== 2 || !Array.isArray(data.slots)) {
    const oldProgress = Math.max(0, Math.min(totalNights, Number(read(LEGACY_PROGRESS)) || 0));
    const hasOldNotes = read('nnn.notes.v1') !== null;
    data = { version: 2, nextId: 1, slots: [] };
    if (oldProgress >= totalNights) stars |= 3;
    else if (oldProgress > 0 || hasOldNotes) {
      data.slots.push({ id: 1, createdAt: 1, completed: oldProgress });
      data.nextId = 2;
    }
    write(STARS_KEY, String(stars));
    write(KEY, JSON.stringify(data));
  }
  const seen = new Set();
  data.slots = data.slots.filter(slot => {
    if (!slot || !Number.isSafeInteger(slot.id) || slot.id < 1
        || !Number.isInteger(slot.completed) || slot.completed < 0
        || slot.completed >= totalNights || seen.has(slot.id)) return false;
    seen.add(slot.id);
    slot.createdAt = Number.isFinite(slot.createdAt) ? slot.createdAt : slot.id;
    return true;
  }).sort((a, b) => a.createdAt - b.createdAt || a.id - b.id).slice(-2);
  data.nextId = Math.max(1, Number.isSafeInteger(data.nextId) ? data.nextId : 1,
    ...data.slots.map(slot => slot.id + 1));
  const save = () => write(KEY, JSON.stringify(data));
  const all = () => data.slots.map(slot => ({ ...slot }));
  const get = id => data.slots.find(slot => slot.id === id);
  const eviction = () => [...data.slots].sort((a, b) => a.completed - b.completed
    || a.createdAt - b.createdAt || a.id - b.id)[0] || null;

  function create() {
    const removed = data.slots.length >= 2 ? eviction() : null;
    if (removed) data.slots = data.slots.filter(slot => slot.id !== removed.id);
    const slot = { id: data.nextId++, completed: 0, createdAt: Date.now() };
    data.slots.push(slot);
    save();
    return { slot: { ...slot }, removed: removed ? { ...removed } : null };
  }

  function advance(id, night) {
    const slot = get(id);
    if (!slot || !Number.isInteger(night) || night < 1 || night > totalNights
        || night > slot.completed + 1) return null;
    slot.completed = Math.max(slot.completed, night);
    const closed = slot.completed === totalNights;
    if (closed) data.slots = data.slots.filter(item => item.id !== id);
    save();
    return { closed, slot: { ...slot } };
  }

  function remove(id) {
    const slot = get(id);
    if (!slot) return null;
    data.slots = data.slots.filter(item => item.id !== id);
    save();
    return { ...slot };
  }

  function award(bit) {
    stars |= bit;
    write(STARS_KEY, String(stars));
    return stars;
  }

  return { all, get: id => { const slot = get(id); return slot ? { ...slot } : null; },
    eviction: () => { const slot = eviction(); return slot ? { ...slot } : null; },
    create, advance, remove, stars: () => stars,
    awardCampaign: remaining => award(1 | (remaining > 0 ? 2 : 0)),
    awardMaxNight: () => award(4) };
}

window.NathGame.createCampaignStore = createCampaignStore;
})();