/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseBackup } from './backup.ts';

const valid = () => ({
  format: 'zing-backup',
  version: 1,
  exportedAt: '2026-10-31T12:00:00.000Z',
  account: { email: 'ana@example.com' },
  user: { displayName: 'Ana' },
  categories: [{ id: 'pain', name: 'Dor', type: 'symptom', color: '#FFB347', isDefault: true }],
  children: [
    {
      id: 'c1',
      name: 'Leo',
      avatarColor: '#1690d2',
      avatarIcon: 'shark',
      birthYear: null,
      kidMode: true,
      createdAt: '2026-10-01T10:00:00.000Z',
      archivedAt: null,
      brushingSlots: [
        { id: 's1', label: 'Café', icon: 'sun', mealType: 'breakfast', windowStart: '06:00', windowEnd: '10:00', sortOrder: 0, createdAt: '2026-10-01T10:00:00.000Z', archivedAt: null },
      ],
      brushingSessions: [{ id: 'x1', slotId: 's1', date: '2026-10-02', startedAt: '2026-10-02T08:00:00.000Z', durationSec: 120, completed: true }],
      toothEvents: [{ id: 'e1', fdi: 55, type: 'symptom', categoryId: 'pain', note: '', date: '2026-10-03' }],
    },
  ],
});

test('a valid export parses, with dates revived', () => {
  const b = parseBackup(JSON.stringify(valid()));
  assert.ok(b);
  assert.equal(b.children[0].name, 'Leo');
  assert.ok(b.children[0].createdAt instanceof Date);
  assert.ok(b.children[0].brushingSessions[0].startedAt instanceof Date);
  assert.equal(b.children[0].birthYear, null);
});

test('anything else is rejected as a whole', () => {
  assert.equal(parseBackup('not json'), null);
  assert.equal(parseBackup(JSON.stringify({ ...valid(), format: 'other-app' })), null);
  assert.equal(parseBackup(JSON.stringify({ ...valid(), version: 2 })), null);
  const badTooth = valid();
  badTooth.children[0].toothEvents[0].fdi = 16; // permanent tooth: not on the kids chart
  assert.equal(parseBackup(JSON.stringify(badTooth)), null);
  const badId = valid();
  badId.children[0].id = 'a/b'; // would escape the path
  assert.equal(parseBackup(JSON.stringify(badId)), null);
  const badWindow = valid();
  badWindow.children[0].brushingSlots[0].windowStart = '6am';
  assert.equal(parseBackup(JSON.stringify(badWindow)), null);
  const reversed = valid();
  reversed.children[0].brushingSlots[0].windowStart = '22:00';
  reversed.children[0].brushingSlots[0].windowEnd = '06:00';
  assert.equal(parseBackup(JSON.stringify(reversed)), null, 'the rules refuse windows that end before they start');
  for (const id of ['.', '..', '__x__']) {
    const b = valid();
    b.children[0].brushingSessions[0].id = id;
    assert.equal(parseBackup(JSON.stringify(b)), null, `id ${id}`);
  }
  const farFuture = valid();
  farFuture.children[0].brushingSessions[0].startedAt = '+275760-09-13T00:00:00.000Z';
  assert.equal(parseBackup(JSON.stringify(farFuture)), null);
  const tooMany = valid();
  tooMany.children = Array.from({ length: 21 }, (_, i) => ({ ...valid().children[0], id: `c${i}` }));
  assert.equal(parseBackup(JSON.stringify(tooMany)), null);
});

test('children archived mid-deletion are left out', () => {
  const b = valid();
  (b.children[0] as { archivedAt: string | null }).archivedAt = '2026-10-31T10:00:00.000Z';
  assert.deepEqual(parseBackup(JSON.stringify(b))?.children, []);
});
