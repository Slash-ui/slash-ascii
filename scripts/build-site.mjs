#!/usr/bin/env node
// Builds the GitHub Pages site. Every example on the page is produced by
// running the tool here, at build time, so the page cannot drift from what
// the code actually does: if rendering changes, the site changes with it.
import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { convert } from '../dist/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'site', 'dist');

/** The document renderer emits a whole page; the site wants only the art. */
function fragment(html) {
  const match = html.match(/<pre class="ascii">([\s\S]*)<\/pre>/);
  if (!match) throw new Error('the html renderer no longer emits <pre class="ascii">');
  return match[1];
}

async function art(source, options) {
  const html = await convert(await readFile(join(root, source)), {
    ...options,
    format: 'html',
    color: 'true',
  });
  return `<pre class="art">${fragment(html)}</pre>`;
}

const version = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;

const slots = {
  version: ` v${version}`,
  ascii: await art('docs/logo-dark.png', { width: 100, charset: 'ascii', lineArt: true }),
  blocks: await art('docs/logo-dark.png', { width: 100, charset: 'blocks', lineArt: true }),
  braille: await art('docs/logo-dark.png', { width: 100, charset: 'braille', lineArt: true }),
  lineart: await art('docs/logo-dark.png', { width: 124, charset: 'blocks', lineArt: true }),
};

let page = await readFile(join(root, 'site', 'index.html'), 'utf8');
for (const [name, value] of Object.entries(slots)) {
  const marker = `<!--SLOT:${name}-->`;
  if (!page.includes(marker)) throw new Error(`the template has no ${marker}`);
  page = page.replaceAll(marker, value);
}

const left = page.match(/<!--SLOT:[a-z]+-->/);
if (left) throw new Error(`nothing filled ${left[0]}`);

await mkdir(out, { recursive: true });
await writeFile(join(out, 'index.html'), page);
// Pages serves this tree directly, so the images the page points at locally
// have to travel with it. The README uses raw.githubusercontent urls and is
// unaffected either way.
await cp(join(root, 'docs'), join(out, 'docs'), { recursive: true });
// Jekyll would otherwise try to process the output and drop anything it does
// not recognise.
await writeFile(join(out, '.nojekyll'), '');

console.log(`built site/dist for v${version}: ${(page.length / 1024).toFixed(1)} kB`);
