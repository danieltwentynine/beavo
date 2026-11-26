/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mouthMapZoneAngles } from '../../components/brushing/mouthMapGeometry.ts';

test('mouth map places side and back zones on the named side of both arches', () => {
  const sectors = mouthMapZoneAngles();
  assert.equal(sectors.length, 10);
  assert.equal(new Set(sectors.map(({ zone }) => zone)).size, 10);

  const center = 110;
  const radius = 73;
  for (const { zone, start, end } of sectors) {
    const midpoint = ((start + end) / 2) * Math.PI / 180;
    const x = center + radius * Math.cos(midpoint);
    const y = center + radius * Math.sin(midpoint);
    assert.ok(zone.startsWith('top-') ? y < center : y > center, zone);
    if (zone.endsWith('-left')) assert.ok(x < center, zone);
    if (zone.endsWith('-right')) assert.ok(x > center, zone);
    if (zone.endsWith('-front')) assert.ok(Math.abs(x - center) < 0.001, zone);
  }
});
