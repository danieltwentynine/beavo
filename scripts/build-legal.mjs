// Builds /legal/*.md into static pages under public/legal/ for Firebase Hosting.
// Runs as the Hosting predeploy step (firebase.json) or: npm run build:legal
// The app links to https://<project>.web.app/legal/<name>.html (lib/legal.ts).
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

import { marked } from 'marked';

const src = new URL('../legal/', import.meta.url);
const out = new URL('../public/legal/', import.meta.url);
mkdirSync(out, { recursive: true });

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// The version in each document must match what the app asks parents to accept.
const versions = readFileSync(new URL('../lib/legal.ts', import.meta.url), 'utf8');
const expected = {
  terms: versions.match(/terms: '([^']+)'/)?.[1],
  'privacy-policy': versions.match(/privacy: '([^']+)'/)?.[1],
};

const files = readdirSync(src).filter((f) => f.endsWith('.md'));
for (const file of files) {
  const md = readFileSync(new URL(file, src), 'utf8');
  const doc = file.split('.')[0];
  const version = md.match(/\*\*(?:Versão|Version):\*\* (\S+)/)?.[1];
  if (!expected[doc] || version !== expected[doc]) {
    throw new Error(`${file}: version ${version} does not match LEGAL_VERSIONS in lib/legal.ts (${expected[doc]})`);
  }
  const lang = file.includes('.pt-BR.') ? 'pt-BR' : 'en';
  const title = md.match(/^# (.+)$/m)?.[1] ?? 'Beavo';
  const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; background: #FFF6DA; color: #14142B; font: 17px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 24px 16px 64px; }
  h1, h2, h3 { line-height: 1.25; }
  a { color: #1F45DB; }
  blockquote { margin: 0 0 24px; padding: 12px 16px; background: #FFB347; border: 3px solid #14142B; border-radius: 12px; }
  blockquote p { margin: 0; }
  table { border-collapse: collapse; width: 100%; display: block; overflow-x: auto; }
  th, td { border: 2px solid #14142B; padding: 8px; text-align: left; vertical-align: top; }
  th { background: #fff; }
</style>
</head>
<body><main>
${marked.parse(md)}
</main></body>
</html>
`;
  writeFileSync(new URL(file.replace(/\.md$/, '.html'), out), html);
}
console.log(`built ${files.length} legal pages into public/legal/`);
