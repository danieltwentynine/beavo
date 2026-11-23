/// <reference types="node" />
// Owner rule: "The parental control is only for app settings and child management."
// Static checks over the screens (the repo has no component-test runner): sign-up
// never uses the grown-ups check, and the check appears only where it is allowed.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url).pathname;
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

function files(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const rel = join(dir, name);
    return statSync(join(root, rel)).isDirectory() ? files(rel) : /\.tsx?$/.test(name) ? [rel] : [];
  });
}

test('consent: accepting needs only the two items — no gate, PIN or question', () => {
  const consent = read('app/consent.tsx');
  assert.doesNotMatch(consent, /ParentalGate|useParentalGate|requireParent/);
  assert.match(consent, /const onAccept = \(\) => void accept\(\);/);
  assert.match(consent, /disabled=\{!allChecked\}/, 'still requires both items');
});

test('consent: the Terms and Privacy links open directly', () => {
  const consent = read('app/consent.tsx');
  assert.match(consent, /onPress=\{\(\) => void Linking\.openURL\(url\)/);
});

test('sign-up and sign-in screens never use the gate', () => {
  for (const file of ['app/(auth)/login.tsx', 'app/(auth)/register.tsx', 'app/onboarding/welcome.tsx', 'app/consent.tsx']) {
    assert.doesNotMatch(read(file), /ParentalGate|useParentalGate|requireParent/, file);
  }
});

test('the gate is used only on settings and child-management screens', () => {
  const allowed = new Set([
    'app/settings.tsx', // PIN
    'app/child-picker.tsx', // add a child; leave kid mode by switching child
    'app/child-form.tsx', // delete a child
    'app/move-data.tsx', // move / erase device data
    'app/tooth-sheet.tsx', // delete a child's tooth records
    'app/(tabs)/brushing.tsx', // Grownups chip: leave kid mode
    'app/(tabs)/more.tsx', // settings, routine, categories, backup, delete account, erase
  ]);
  const users = [...files('app'), ...files('components')].filter(
    (f) => f !== 'components/ui/ParentalGate.tsx' && /useParentalGate|<ParentalGate/.test(read(f)),
  );
  for (const f of users) assert.ok(allowed.has(f), `${f} uses the grown-ups check outside settings / child management`);
});

test('More tab: legal and review links, sign-in, sign-up and sign-out are not gated', () => {
  const more = read('app/(tabs)/more.tsx');
  assert.doesNotMatch(more, /requireParent\([^)]*openExternal/);
  assert.doesNotMatch(more, /requireParent\(confirmSignOut\)/);
  assert.doesNotMatch(more, /requireParent\(\(\) => router\.push\('\/\(auth\)/);
  for (const kept of ["router.push('/settings')", "router.push('/slots')", "router.push('/categories')", 'requireParent(confirmDelete)', 'requireParent(confirmErase)']) {
    assert.ok(more.includes(kept), `still gated: ${kept}`);
  }
});

test('tooth sheet: only deleting a record is gated, adding opens directly', () => {
  const sheet = read('app/tooth-sheet.tsx');
  assert.match(sheet, /const startForm = \(type: ToothEventType\) => openForm\(type\);/);
  assert.match(sheet, /setPending\(\{ deleteId: e\.id \}\)/);
});
