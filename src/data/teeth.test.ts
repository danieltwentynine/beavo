/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ARCH_VIEWBOX,
  PRIMARY_TEETH,
  archOrder,
  countForYear,
  isPrimaryTooth,
  isValidEventDate,
  layoutArch,
  nearestTooth,
  newestFirst,
  statusByTooth,
  toothInfo,
} from './teeth.ts';

test('primary dentition: 20 teeth, FDI 51–55, 61–65, 71–75, 81–85', () => {
  assert.equal(PRIMARY_TEETH.length, 20);
  for (const fdi of [51, 55, 61, 65, 71, 75, 81, 85]) assert.ok(isPrimaryTooth(fdi));
  for (const fdi of [11, 36, 56, 50, 86]) assert.ok(!isPrimaryTooth(fdi));
});

test('toothInfo reads quadrant and position', () => {
  assert.deepEqual(toothInfo(55), { fdi: 55, arch: 'upper', side: 'right', kind: 'secondMolar' });
  assert.deepEqual(toothInfo(61), { fdi: 61, arch: 'upper', side: 'left', kind: 'centralIncisor' });
  assert.deepEqual(toothInfo(73), { fdi: 73, arch: 'lower', side: 'left', kind: 'canine' });
  assert.deepEqual(toothInfo(84), { fdi: 84, arch: 'lower', side: 'right', kind: 'firstMolar' });
});

test('dentist view puts the child\'s right on the viewer\'s left; patient view mirrors it', () => {
  assert.deepEqual(archOrder('upper', 'dentist'), [55, 54, 53, 52, 51, 61, 62, 63, 64, 65]);
  assert.deepEqual(archOrder('lower', 'dentist'), [85, 84, 83, 82, 81, 71, 72, 73, 74, 75]);
  assert.deepEqual(archOrder('upper', 'patient'), [65, 64, 63, 62, 61, 51, 52, 53, 54, 55]);
});

test('layout: every tooth placed once, inside the viewBox, upper above lower, mirror-symmetric', () => {
  const layout = layoutArch('dentist');
  assert.deepEqual([...layout.map((t) => t.fdi)].sort(), [...PRIMARY_TEETH].sort());
  for (const t of layout) {
    assert.ok(t.x - t.width / 2 > 0 && t.x + t.width / 2 < ARCH_VIEWBOX.width, `${t.fdi} x`);
    assert.ok(t.y - t.depth / 2 > 0 && t.y + t.depth / 2 < ARCH_VIEWBOX.height, `${t.fdi} y`);
  }
  const at = (fdi: number) => layout.find((t) => t.fdi === fdi)!;
  assert.ok(at(51).y < at(55).y, 'upper incisors are at the top of the upper arc');
  assert.ok(at(81).y > at(85).y, 'lower incisors are at the bottom of the lower arc');
  assert.ok(Math.max(...layout.filter((t) => t.arch === 'upper').map((t) => t.y)) < Math.min(...layout.filter((t) => t.arch === 'lower').map((t) => t.y)));
  // 55 and 65 mirror each other around the vertical axis.
  assert.ok(Math.abs(at(55).x + at(65).x - ARCH_VIEWBOX.width) < 0.5);
  assert.ok(Math.abs(at(55).y - at(65).y) < 0.5);
  // Midline incisors sit flat (tangent horizontal): upper 0°, lower 180°.
  assert.ok(Math.abs(at(51).rotation) < 10);
  assert.ok(Math.abs(Math.abs(at(81).rotation) - 180) < 10);
});

test('layout: neighbouring teeth do not overlap along the arch', () => {
  const layout = layoutArch('dentist');
  for (const arch of ['upper', 'lower'] as const) {
    const row = layout.filter((t) => t.arch === arch);
    for (let i = 1; i < row.length; i++) {
      const a = row[i - 1];
      const b = row[i];
      const gap = Math.hypot(a.x - b.x, a.y - b.y);
      assert.ok(gap >= (a.width + b.width) / 2 - 0.5, `${a.fdi}–${b.fdi} overlap (${gap.toFixed(1)})`);
    }
  }
});

test('nearestTooth: exact center hits, far away misses', () => {
  const layout = layoutArch('dentist');
  const t = layout.find((x) => x.fdi === 72)!;
  assert.equal(nearestTooth(layout, t.x, t.y, 22), 72);
  assert.equal(nearestTooth(layout, t.x + 3, t.y - 2, 22), 72);
  assert.equal(nearestTooth(layout, ARCH_VIEWBOX.width / 2, ARCH_VIEWBOX.height / 2, 22), null);
});

test('statusByTooth merges symptom and treatment', () => {
  const s = statusByTooth([
    { fdi: 54, type: 'symptom' },
    { fdi: 54, type: 'symptom' },
    { fdi: 61, type: 'treatment' },
    { fdi: 75, type: 'symptom' },
    { fdi: 75, type: 'treatment' },
  ]);
  assert.deepEqual(s, { 54: 'symptom', 61: 'treatment', 75: 'both' });
});

test('countForYear counts only that year', () => {
  const counts = countForYear(
    [
      { type: 'symptom', date: '2026-01-02' },
      { type: 'symptom', date: '2025-12-31' },
      { type: 'treatment', date: '2026-10-31' },
      { type: 'treatment', date: '2026-03-01' },
    ],
    2026,
  );
  assert.deepEqual(counts, { symptoms: 1, treatments: 2 });
});

test('newestFirst sorts by date descending', () => {
  const sorted = newestFirst([
    { id: 'a', date: '2026-01-02' },
    { id: 'b', date: '2026-10-31' },
    { id: 'c', date: '2025-05-05' },
  ]);
  assert.deepEqual(sorted.map((e) => e.id), ['b', 'a', 'c']);
});

test('isValidEventDate: real dates, not in the future', () => {
  assert.ok(isValidEventDate('2026-10-31', '2026-10-31'));
  assert.ok(isValidEventDate('2024-02-29', '2026-10-31'));
  assert.ok(!isValidEventDate('2026-11-01', '2026-10-31'));
  assert.ok(!isValidEventDate('2025-02-29', '2026-10-31'));
  assert.ok(!isValidEventDate('31/10/2026', '2026-10-31'));
});
