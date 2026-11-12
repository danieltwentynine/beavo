// Gemini prompt/sanitizer self-check — run: node lib/gemini.check.mjs
// Plain node + assert on purpose: this repo has no test framework and doesn't need one.
// Only the pure helpers are exercised; the network call is not.
import assert from 'node:assert/strict';

import { NAME_TOKEN, buildCoachPrompt, sanitizeCoachReply } from './gemini.ts';

const base = { age: 6, missedZones: [], score: 100, streakDays: 0 };

// --- prompt: privacy and shape ---
const prompt = buildCoachPrompt({ ...base, missedZones: ['top-back-left', 'bottom-front', 'top-left'], streakDays: 5 });
assert.ok(prompt.includes(NAME_TOKEN), 'prompt uses the name placeholder');
assert.ok(prompt.includes('top back teeth on the left') && prompt.includes('bottom front teeth'), 'first two missed zones named');
assert.ok(!prompt.includes('top left teeth'), 'third missed zone is dropped (max 2)');
assert.ok(prompt.includes('5-day'), 'streak >= 3 is mentioned');
assert.ok(!buildCoachPrompt({ ...base, streakDays: 2 }).includes('streak'), 'streak <= 2 is not mentioned');
assert.ok(buildCoachPrompt({ ...base, age: 5 }).includes('analogy'), 'young kids get analogies');
assert.ok(!buildCoachPrompt({ ...base, age: 10 }).includes('analogy'), 'older kids do not');
assert.ok(buildCoachPrompt({ ...base, locale: 'pt-BR' }).includes('Brazilian Portuguese'), 'locale is passed through');
assert.ok(buildCoachPrompt({ ...base, locale: 'es' }).includes('Spanish'), 'Spanish is supported');

// --- sanitizer ---
assert.equal(sanitizeCoachReply('Great job, {NAME}! You brushed like a shark.', 'Mia'), 'Great job, Mia! You brushed like a shark.');
assert.equal(sanitizeCoachReply('"**Nice,** {NAME}!"', 'Mia'), 'Nice, Mia!', 'markdown and quotes stripped');
assert.equal(sanitizeCoachReply('One. Two. Three.', 'Mia'), 'One. Two.', 'capped at two sentences');
assert.equal(sanitizeCoachReply('Brush well to avoid cavities, {NAME}.', 'Mia'), null, 'clinical wording rejected');
assert.equal(sanitizeCoachReply('Try Colgate, {NAME}!', 'Mia'), null, 'brand names rejected');
assert.equal(sanitizeCoachReply('¡Así evitas las caries, {NAME}!', 'Mia'), null, 'Spanish clinical wording rejected');
assert.equal(sanitizeCoachReply('Isso tira a placa, {NAME}!', 'Mia'), null, 'Portuguese clinical wording rejected');
assert.equal(sanitizeCoachReply('   ', 'Mia'), null, 'empty rejected');
assert.equal(sanitizeCoachReply('x'.repeat(300) + '.', 'Mia'), null, 'overlong rejected');
assert.equal(sanitizeCoachReply('Yay {NAME}!', '  '), 'Yay friend!', 'blank name falls back to friend');

console.log('gemini.check: ok');
