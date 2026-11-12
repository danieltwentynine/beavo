// Translations self-check — run: node lib/translations.check.mjs
// Plain node + assert on purpose: this repo has no test framework and doesn't need one.
// tsc already guarantees every language has every key; this covers what types can't.
import assert from 'node:assert/strict';

import { TABLES, pickLocale, translate } from './translations.ts';

const placeholders = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
/** The sticker is one line at 15px on the narrowest phone. */
const CHEER_MAX_CHARS = 24;

for (const [locale, table] of Object.entries(TABLES)) {
  for (const [key, text] of Object.entries(table)) {
    assert.ok(text.trim().length > 0, `${locale} ${key} is empty`);
    assert.equal(
      placeholders(text),
      placeholders(TABLES.en[key]),
      `${locale} ${key} must use the same placeholders as English`,
    );
    if (key.startsWith('cheer.')) {
      assert.ok(text.length <= CHEER_MAX_CHARS, `${locale} ${key} is too long for the sticker: "${text}"`);
    }
  }
}

// --- device language → app language ---
assert.equal(pickLocale(['pt-BR']), 'pt-BR');
assert.equal(pickLocale(['pt-PT']), 'pt-BR', 'any Portuguese gets pt-BR');
assert.equal(pickLocale(['es-MX']), 'es');
assert.equal(pickLocale(['es-419']), 'es');
assert.equal(pickLocale(['en-GB']), 'en');
assert.equal(pickLocale(['fr-FR']), 'en', 'an unsupported language falls back to English');
assert.equal(pickLocale(['fr-FR', 'es-ES', 'en-US']), 'es', 'the first supported preference wins');
assert.equal(pickLocale(['en-US', 'pt-BR']), 'en');
assert.equal(pickLocale([]), 'en');
assert.equal(pickLocale(['PT_br']), 'pt-BR', 'case and underscore are tolerated');

// --- interpolation ---
assert.equal(translate('en', 'home.age', { age: 6 }), 'Age 6');
assert.equal(translate('pt-BR', 'home.age', { age: 6 }), '6 anos');
assert.equal(translate('es', 'session.ready', { name: 'Leo' }), '¡Prepara tu cepillo, Leo!');
assert.equal(translate('en', 'home.age'), 'Age {age}', 'a missing param is left visible, not blanked');
assert.equal(
  translate('en', 'session.ready', { name: '{name} $& $1' }),
  'Get your toothbrush ready, {name} $& $1!',
  'a child name is inserted literally',
);

console.log('translations check ok');
