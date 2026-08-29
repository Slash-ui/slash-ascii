import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ModelSpec } from './registry.js';
import { DownloadError, IntegrityError } from '../errors.js';
import { ensureDir, modelPath, recordInstall } from './cache.js';
import { formatBytes } from './registry.js';

export interface Progress {
  received: number;
  /** Null when the server does not send a length. */
  total: number | null;
}

export interface TransferOptions {
  /** Injectable so tests can serve a fake model, and so no test ever reaches the network. */
  fetchImpl?: typeof fetch;
  onProgress?: (progress: Progress) => void;
  signal?: AbortSignal;
}

export async function downloadModel(
  spec: ModelSpec,
  dir: string,
  options: TransferOptions = {},
): Promise<void> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  let response: Response;
  try {
    response = await fetchImpl(spec.url, { signal: options.signal, redirect: 'follow' });
  } catch (err) {
    throw new DownloadError(`could not reach ${spec.url}: ${(err as Error).message}`);
  }
  if (!response.ok) {
    throw new DownloadError(`${spec.url} returned ${response.status} ${response.statusText}`);
  }
  if (!response.body) {
    throw new DownloadError(`${spec.url} returned an empty body`);
  }

  const header = response.headers.get('content-length');
  const total = header ? Number(header) : null;
  let received = 0;
  const source = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);

  await writeVerified(source, spec, dir, (chunk) => {
    received += chunk;
    options.onProgress?.({ received, total });
  });
}

/** Same integrity guarantee for a file copied in by hand as for a download. */
export async function installFromFile(spec: ModelSpec, dir: string, source: string): Promise<void> {
  await writeVerified(createReadStream(source), spec, dir);
}

/**
 * Streams into a temporary file in the destination directory, hashing as it
 * goes, and only renames into place once size and checksum both match. The
 * rename is atomic within a filesystem, so a killed process cannot leave behind
 * a half-written file that looks installed.
 */
async function writeVerified(
  source: NodeJS.ReadableStream,
  spec: ModelSpec,
  dir: string,
  onChunk?: (bytes: number) => void,
): Promise<void> {
  await ensureDir(dir);
  const temp = join(dir, `${spec.filename}.${process.pid}.part`);
  const hash = createHash('sha256');
  let bytes = 0;

  // Hashing happens inside the pipeline rather than from a 'data' listener, which
  // would race the pipe and could miss the first chunk.
  const measure = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      bytes += chunk.length;
      hash.update(chunk);
      onChunk?.(chunk.length);
      done(null, chunk);
    },
  });

  try {
    await pipeline(source, measure, createWriteStream(temp));
  } catch (err) {
    await discard(temp);
    throw new DownloadError(`transfer of ${spec.filename} failed: ${(err as Error).message}`);
  }

  if (bytes !== spec.bytes) {
    await discard(temp);
    throw new IntegrityError(
      `${spec.filename} is ${formatBytes(bytes)}, expected ${formatBytes(spec.bytes)}`,
    );
  }

  const actual = hash.digest('hex');
  if (actual !== spec.sha256) {
    await discard(temp);
    throw new IntegrityError(
      `${spec.filename} checksum mismatch\n  expected  ${spec.sha256}\n  actual    ${actual}`,
    );
  }

  await rename(temp, modelPath(dir, spec));
  await recordInstall(dir, spec);
}

async function discard(path: string): Promise<void> {
  await unlink(path).catch(() => {});
}
