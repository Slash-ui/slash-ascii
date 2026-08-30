import { writeFile } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IntegrityError } from '../src/errors.js';
import { MODELS } from '../src/models/registry.js';
import { inspect, loadModel, removeModel, resolveModelDir } from '../src/models/cache.js';
import { installFromFile } from '../src/models/download.js';
import { withTempDir } from './helpers.js';

const spec = { ...MODELS.lite, filename: 'fake.onnx', bytes: 8, sha256: '' };
const payload = Buffer.from('12345678');
const realSha = 'ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f';

describe('model directory', () => {
  it('takes the override when there is one', () => {
    expect(resolveModelDir('/from/flag')).toBe('/from/flag');
  });

  it('otherwise lands in the per-OS cache directory', () => {
    const fallback = resolveModelDir();
    // Windows puts a "Cache" segment between the two, so the whole tail is not
    // the same shape everywhere. What holds on every platform is that the
    // directory is named for the tool and ends at models.
    expect(fallback).toContain('slash-ascii');
    expect(fallback.endsWith(`${sep}models`)).toBe(true);
    // env-paths appends "-nodejs" unless told otherwise, which would be an odd
    // path to document in a README.
    expect(fallback).not.toContain('nodejs');
  });
});

describe('inspecting the cache', () => {
  it('reports a model that was never installed', async () => {
    await withTempDir(async (dir) => {
      expect(await inspect(dir, { ...spec, sha256: realSha })).toEqual({ state: 'missing' });
    });
  });

  it('accepts a file matching the pinned size and checksum', async () => {
    await withTempDir(async (dir) => {
      const model = { ...spec, sha256: realSha };
      const source = join(dir, 'source.bin');
      await writeFile(source, payload);
      await installFromFile(model, dir, source);

      expect(await inspect(dir, model)).toEqual({ state: 'installed', bytes: 8 });
      expect(await loadModel(dir, model)).toEqual(new Uint8Array(payload));
    });
  });

  it('rejects a file of the wrong length', async () => {
    await withTempDir(async (dir) => {
      const model = { ...spec, sha256: realSha };
      await writeFile(join(dir, model.filename), Buffer.from('123'));

      const status = await inspect(dir, model);
      expect(status.state).toBe('corrupt');
      await expect(loadModel(dir, model)).rejects.toThrow(IntegrityError);
    });
  });

  it('rejects a file of the right length with the wrong contents', async () => {
    await withTempDir(async (dir) => {
      const model = { ...spec, sha256: realSha };
      await writeFile(join(dir, model.filename), Buffer.from('87654321'));

      const status = await inspect(dir, model);
      expect(status.state).toBe('corrupt');
      if (status.state === 'corrupt') expect(status.detail).toContain('sha256');
    });
  });

  it('removes an installed model and reports when there was nothing to remove', async () => {
    await withTempDir(async (dir) => {
      const model = { ...spec, sha256: realSha };
      const source = join(dir, 'source.bin');
      await writeFile(source, payload);
      await installFromFile(model, dir, source);

      expect(await removeModel(dir, model)).toBe(true);
      expect(await removeModel(dir, model)).toBe(false);
      expect(await inspect(dir, model)).toEqual({ state: 'missing' });
    });
  });
});
