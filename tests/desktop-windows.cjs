const assert = require('node:assert/strict');
const { test } = require('node:test');
global.window = { NathGame: {} };
require('../src/notes-ui.js');

function element() {
  return { hidden: true, dataset: {}, style: {}, attributes: {}, events: {},
    toggleAttribute(key, active) { if (active) this.attributes[key] = ''; else delete this.attributes[key]; },
    setAttribute(key, value) { this.attributes[key] = value; },
    addEventListener(key, fn) { this.events[key] = fn; } };
}

test('shared window stack preserves background apps, task state and restored contents', () => {
  const changes = [];
  const manager = window.NathGame.createDesktopWindows(id => changes.push(id));
  const apps = Object.fromEntries(['cameras', 'files', 'notes'].map(id => {
    const panel = element(), task = element();
    manager.register(id, panel, task);
    return [id, { panel, task }];
  }));
  manager.raise('files');
  apps.files.panel.loaded = 'document';
  manager.minimize('files');
  assert(manager.isOpen('files'));
  assert('data-open' in apps.files.task.attributes);
  manager.raise('cameras');
  manager.toggle('files', assert.fail);
  assert.equal(manager.foreground(), 'files');
  assert(!apps.cameras.panel.hidden);
  assert.equal(apps.cameras.task.attributes['aria-pressed'], 'false');
  assert(Number(apps.files.panel.style.zIndex) > Number(apps.cameras.panel.style.zIndex));
  assert.equal(apps.files.panel.loaded, 'document');
  manager.toggle('files', assert.fail);
  assert(apps.files.panel.hidden);
  assert.equal(manager.foreground(), 'cameras');
  manager.raise('notes');
  apps.cameras.panel.events.pointerdown();
  assert.equal(manager.foreground(), 'cameras');
  assert(!apps.notes.panel.hidden);
  manager.close('cameras');
  assert(!('data-open' in apps.cameras.task.attributes));
  assert.equal(manager.foreground(), 'notes');
  manager.minimizeAll();
  assert.equal(manager.foreground(), undefined);
  assert(manager.isOpen('notes'));
  manager.reset();
  for (const [id, app] of Object.entries(apps)) {
    assert(!manager.isOpen(id));
    assert(app.panel.hidden);
    assert(!('data-open' in app.task.attributes));
  }
});
