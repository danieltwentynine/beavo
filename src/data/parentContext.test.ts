/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isParentContext } from './parentContext.ts';

test('cold launch: nothing loaded yet is never a parent context, even with a pending notice', () => {
  assert.equal(isParentContext({ loaded: false, activeChild: null, childCount: 0 }), false);
  assert.equal(isParentContext({ loaded: false, activeChild: { kidMode: false }, childCount: 1 }), false);
});

test('profile switch: mid-switch (children but no active one) hides; kid-mode child hides; parent profile shows', () => {
  assert.equal(isParentContext({ loaded: true, activeChild: null, childCount: 2 }), false);
  assert.equal(isParentContext({ loaded: true, activeChild: { kidMode: true }, childCount: 2 }), false);
  assert.equal(isParentContext({ loaded: true, activeChild: { kidMode: false }, childCount: 2 }), true);
});

test('a parent with no children yet (setting up) is a parent context', () => {
  assert.equal(isParentContext({ loaded: true, activeChild: null, childCount: 0 }), true);
});
