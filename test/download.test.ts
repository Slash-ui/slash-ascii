import { createServer, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import { readdir, stat, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ModelSpec } from '../src/models/registry.js';
import { DownloadError, IntegrityError } from '../src/errors.js';
import { downloadModel, installFromFile } from '../src/models/download.js';
import { inspect, readManifest } from '../src/models/cache.js';
import { withTempDir } from './helpers.js';

// A stand-in for a real model: small enough to serve from memory, and its
// checksum is computed here rather than pinned, so the test cannot drift.
const PAYLOAD = Buffer.from(Array.from({ length: 2048 }, (_, i) => (i * 7 + 13) % 256));
const SHA256 = createHash('sha256').update(PAYLOAD).digest('hex');

let server: Server;
let origin: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/model') {
      res.writeHead(200, { 'content-length': String(PAYLOAD.length) });
      res.end(PAYLOAD);
      return;
    }
    if (req.url === '/wrong') {
      const other = Buffer.alloc(PAYLOAD.length, 0x41);
      res.writeHead(200, { 'content-length': String(other.length) });
      res.end(other);
      return;
    }
    if (req.url === '/short') {
      // Promises the full length, then hangs up halfway through.
      res.writeHead(200, { 'content-length': String(PAYLOAD.length) });
      res.write(PAYLOAD.subarray(0, 1000));
      res.destroy();
      return;
    }
    res.writeHead(404).end('nope');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const spec = (path: string, overrides: Partial<ModelSpec> = {}): ModelSpec => ({
  id: 'lite',
  name: 'test model',
  filename: 'test-model.onnx',
  url: `${origin}${path}`,
  bytes: PAYLOAD.length,
  sha256: SHA256,
  license: 'Apache-2.0',
  sourceName: '127.0.0.1',
  summary: 'a stand-in',
  inputSize: 320,
  ...overrides,
});

const partFiles = async (dir: string): Promise<string[]> =>
  (await readdir(dir)).filter((name) => name.endsWith('.part'));

describe('downloading a model', () => {
  it('writes the file and records it in the manifest', async () => {
    await withTempDir(async (dir) => {
      const model = spec('/model');
      await downloadModel(model, dir, { fetchImpl: fetch });

      expect((await stat(join(dir, model.filename))).size).toBe(PAYLOAD.length);
      expect((await readManifest(dir)).models.lite.sha256).toBe(SHA256);
      expect(await inspect(dir, model)).toEqual({ state: 'installed', bytes: PAYLOAD.length });
      expect(await partFiles(dir)).toEqual([]);
    });
  });

  it('reports progress as bytes arrive', async () => {
    await withTempDir(async (dir) => {
      const onProgress = vi.fn();
      await downloadModel(spec('/model'), dir, { fetchImpl: fetch, onProgress });

      expect(onProgress).toHaveBeenCalled();
      const last = onProgress.mock.calls.at(-1)![0];
      expect(last).toEqual({ received: PAYLOAD.length, total: PAYLOAD.length });
    });
  });

  it('refuses a file whose checksum does not match, and keeps nothing', async () => {
    await withTempDir(async (dir) => {
      const model = spec('/wrong');
      await expect(downloadModel(model, dir, { fetchImpl: fetch })).rejects.toThrow(IntegrityError);

      await expect(stat(join(dir, model.filename))).rejects.toThrow();
      expect(await partFiles(dir)).toEqual([]);
    });
  });

  it('fails on a truncated transfer', async () => {
    await withTempDir(async (dir) => {
      const model = spec('/short');
      const error = await downloadModel(model, dir, { fetchImpl: fetch }).catch((err) => err);

      expect(error).toBeInstanceOf(DownloadError);
      expect(error.exitCode).toBe(4);
      await expect(stat(join(dir, model.filename))).rejects.toThrow();
      expect(await partFiles(dir)).toEqual([]);
    });
  });

  it('fails on a missing artifact', async () => {
    await withTempDir(async (dir) => {
      await expect(downloadModel(spec('/gone'), dir, { fetchImpl: fetch })).rejects.toThrow(
        /404/,
      );
    });
  });

  it('fails when the host cannot be reached', async () => {
    await withTempDir(async (dir) => {
      const unreachable = spec('/model', { url: 'http://127.0.0.1:1/model' });
      const error = await downloadModel(unreachable, dir, { fetchImpl: fetch }).catch((err) => err);

      expect(error).toBeInstanceOf(DownloadError);
      expect(await partFiles(dir)).toEqual([]);
    });
  });
});

describe('installing from a local file', () => {
  it('verifies a hand-copied file the same way as a download', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, 'copied.onnx');
      await writeFile(source, PAYLOAD);

      const model = spec('/model', { filename: 'installed.onnx' });
      await installFromFile(model, dir, source);
      expect(await inspect(dir, model)).toEqual({ state: 'installed', bytes: PAYLOAD.length });
    });
  });

  it('rejects a file that is not the pinned artifact', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, 'impostor.onnx');
      await writeFile(source, Buffer.alloc(PAYLOAD.length, 0x42));

      const model = spec('/model', { filename: 'installed.onnx' });
      await expect(installFromFile(model, dir, source)).rejects.toThrow(IntegrityError);
      expect(await partFiles(dir)).toEqual([]);
    });
  });
});
