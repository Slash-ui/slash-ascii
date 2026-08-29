import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { convert } from '../src/pipeline/run.js';
import { loadConfig } from '../src/config.js';
import { loadRuntime } from '../src/segment/runtime.js';
import { fixture } from './helpers.js';

/**
 * The offline promise is the reason someone would pick this tool over the
 * alternatives, and it is the kind of guarantee that regresses silently. Every
 * default path runs here with fetch rigged to throw.
 */
describe('the default path never touches the network', () => {
  const real = globalThis.fetch;
  let attempts = 0;

  beforeEach(() => {
    attempts = 0;
    globalThis.fetch = (() => {
      attempts++;
      throw new Error('network access attempted');
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = real;
  });

  it('converts an image', async () => {
    const out = await convert(await fixture('shapes.png'), { width: 24, format: 'txt' });
    expect(out).toContain('@');
    expect(attempts).toBe(0);
  });

  it('converts to every output format', async () => {
    const image = await fixture('gradient.png');
    for (const format of ['ansi', 'txt', 'html', 'svg'] as const) {
      expect(await convert(image, { width: 16, format })).toBeTruthy();
    }
    expect(attempts).toBe(0);
  });

  it('reads configuration', async () => {
    await expect(loadConfig()).resolves.toBeTypeOf('object');
    expect(attempts).toBe(0);
  });

  it('loads the inference runtime from disk', async () => {
    const runtime = await loadRuntime();
    expect(['node', 'wasm']).toContain(runtime.backend);
    expect(attempts).toBe(0);
  });
});
