/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseBackup } from './backup.ts';
import {
  hydrateLocal,
  localAddToothEvents,
  localBackup,
  localClear,
  localCreateChild,
  localDeleteChild,
  localImport,
  localRemoveSlot,
  localSeedCategories,
  localUpdateCategory,
  localUpdateChild,
  localWriteSession,
  watchLocalCategories,
  watchLocalChildren,
  watchLocalSessions,
  watchLocalSlots,
} from './local.ts';

const NOW = new Date('2026-11-11T08:00:00.000Z');
const leo = { name: 'Leo', avatarColor: '#1690d2', avatarIcon: 'shark' };
const slot = (id: string, sortOrder = 0) => ({
  id,
  label: 'Café',
  icon: 'sun',
  mealType: 'breakfast' as const,
  windowStart: '06:00',
  windowEnd: '10:00',
  sortOrder,
});
const session = (id: string, slotId = 's1') => ({
  id,
  slotId,
  date: '2026-11-11',
  startedAt: NOW,
  durationSec: 120,
  completed: true,
});

/** A fresh store over an in-memory "disk". */
function start(text: string | null = null) {
  const disk = { text };
  const ok = hydrateLocal(text, async (next) => {
    disk.text = next;
  });
  return { disk, ok };
}

/** The value a listener currently reports. */
async function seen<T>(subscribe: (onChange: (value: T) => void) => () => void): Promise<T> {
  return new Promise((resolve) => {
    const stop = subscribe((value) => {
      resolve(value);
      queueMicrotask(() => stop());
    });
  });
}

test('a child created on the device shows up with its slots, and survives a restart', async () => {
  const { disk } = start();
  await localCreateChild('c1', leo, [slot('s1'), slot('s2', 1)], NOW);

  const children = await seen(watchLocalChildren);
  assert.equal(children.length, 1);
  assert.equal(children[0].name, 'Leo');
  assert.equal(children[0].birthYear, undefined);
  assert.equal(children[0].kidMode, false);
  assert.equal((await seen<unknown[]>((cb) => watchLocalSlots('c1', cb))).length, 2);

  // What is on disk is a valid backup file, and a new launch reads it back.
  assert.ok(disk.text && parseBackup(disk.text));
  start(disk.text);
  assert.equal((await seen(watchLocalChildren))[0].id, 'c1');
});

test('listeners are told about later changes and stop when unsubscribed', async () => {
  start();
  const counts: number[] = [];
  const stop = watchLocalChildren((children) => counts.push(children.length));
  await localCreateChild('c1', leo, [slot('s1')], NOW);
  await localCreateChild('c2', { ...leo, name: 'Ana' }, [slot('s1')], new Date(NOW.getTime() + 1000));
  stop();
  await localDeleteChild('c1');
  assert.deepEqual(counts, [0, 1, 2]);
});

test('a session is saved once per id and needs its child', async () => {
  start();
  await localCreateChild('c1', leo, [slot('s1')], NOW);
  await localWriteSession('c1', session('x1'));
  await localWriteSession('c1', { ...session('x1'), durationSec: 90, completed: false });
  const sessions = await seen<{ durationSec: number }[]>((cb) => watchLocalSessions('c1', cb));
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].durationSec, 90);
  await assert.rejects(localWriteSession('gone', session('x2')));
});

test('a change that would be unreadable is refused and nothing is saved', async () => {
  const { disk } = start();
  await localCreateChild('c1', leo, [slot('s1')], NOW);
  const before = disk.text;
  await assert.rejects(localUpdateChild('c1', { name: '' }));
  await assert.rejects(localAddToothEvents('c1', [{ id: 'e1', fdi: 11, type: 'symptom', categoryId: 'pain', note: '', date: '2026-11-11' }]));
  assert.equal(disk.text, before);
  assert.equal((await seen(watchLocalChildren))[0].name, 'Leo');
});

test('removing a slot archives it when it has sessions, deletes it otherwise', async () => {
  start();
  await localCreateChild('c1', leo, [slot('s1'), slot('s2', 1)], NOW);
  await localWriteSession('c1', session('x1', 's1'));

  const used = await localRemoveSlot('c1', 's1', NOW);
  await used.written;
  assert.equal(used.action, 'archive');
  const unused = await localRemoveSlot('c1', 's2', NOW);
  await unused.written;
  assert.equal(unused.action, 'delete');

  const slots = await seen<{ id: string; archivedAt?: Date }[]>((cb) => watchLocalSlots('c1', cb));
  assert.deepEqual(slots.map((s) => s.id), ['s1']);
  assert.ok(slots[0].archivedAt instanceof Date);
});

test('seeding categories keeps a name the parent changed', async () => {
  start();
  const defaults = [{ id: 'pain', name: 'Dor', type: 'symptom' as const, color: '#FFB347', isDefault: true }];
  await localSeedCategories(defaults);
  await localUpdateCategory('pain', { name: 'Dorzinha' });
  await localSeedCategories(defaults);
  assert.deepEqual((await seen(watchLocalCategories)).map((c) => c.name), ['Dorzinha']);
});

test('the store exports as a backup and imports one by id without losing what was there', async () => {
  start();
  await localCreateChild('c1', leo, [slot('s1')], NOW);
  await localWriteSession('c1', session('x1'));
  const exported = parseBackup(JSON.stringify(await localBackup()));
  assert.ok(exported);

  // A different device: one child of its own, then the import.
  start();
  await localCreateChild('c2', { ...leo, name: 'Ana' }, [slot('s9')], NOW);
  await localCreateChild('c1', { ...leo, name: 'Leo (old)' }, [slot('s1')], NOW);
  await localWriteSession('c1', session('x0'));
  const count = await localImport(exported);

  assert.equal(count, 3); // child + slot + session
  const children = await seen(watchLocalChildren);
  assert.deepEqual(children.map((c) => c.name).sort(), ['Ana', 'Leo']);
  const sessions = await seen<{ id: string }[]>((cb) => watchLocalSessions('c1', cb));
  assert.deepEqual(sessions.map((s) => s.id).sort(), ['x0', 'x1']);
});

test('erasing leaves an empty, valid store on disk', async () => {
  const { disk } = start();
  await localCreateChild('c1', leo, [slot('s1')], NOW);
  await localClear();
  assert.deepEqual(await seen(watchLocalChildren), []);
  assert.deepEqual(parseBackup(disk.text ?? '')?.children, []);
});

test('unreadable storage is reported, and reads as empty rather than crashing', async () => {
  assert.equal(start('{"format":"beavo-ba').ok, false);
  assert.deepEqual(await seen(watchLocalChildren), []);
  assert.equal(start(null).ok, true);
  assert.equal(start('').ok, true);
});
