import { createHash } from 'node:crypto';
import { mkdir, open, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { homedir } from 'node:os';
import { join, sep } from 'node:path';
import envPaths from 'env-paths';
import type { ModelSpec } from './registry.js';
import { IntegrityError } from '../errors.js';

const MANIFEST = 'manifest.json';

/**
 * Hashing is cheap enough to redo on every load for the lite model. The full
 * model is 176 MB, where re-reading it just to confirm what the manifest already
 * recorded is a noticeable delay on every single run.
 */
const REHASH_LIMIT_BYTES = 32 * 1024 * 1024;

export interface ManifestEntry {
  bytes: number;
  sha256: string;
  mtimeMs: number;
  /** Never read back. Provenance for whoever opens this file by hand. */
  installedAt: string;
}

export interface Manifest {
  models: Record<string, ManifestEntry>;
}

/**
 * The override, or the per-OS cache directory. The caller supplies the override,
 * including any environment variable behind it, so this stays a pure function of
 * its argument rather than of the ambient environment.
 */
export function resolveModelDir(override?: string): string {
  return override || join(envPaths('slash-ascii', { suffix: '' }).cache, 'models');
}

export function modelPath(dir: string, spec: ModelSpec): string {
  return join(dir, spec.filename);
}

/**
 * Everything that verifies a cached model works from this one descriptor rather
 * than re-opening the path. `trusted` can waive the checksum on the strength of
 * a stat alone, so a name resolved twice is a window in which the file that was
 * checked and the file that is read need not be the same one.
 */
function openModel(dir: string, spec: ModelSpec): Promise<FileHandle> {
  return open(modelPath(dir, spec), 'r');
}

/** Replaces the home directory with `~` for display. */
export function tildify(path: string): string {
  const home = homedir();
  return path === home || path.startsWith(home + sep) ? '~' + path.slice(home.length) : path;
}

export async function readManifest(dir: string): Promise<Manifest> {
  try {
    const parsed = JSON.parse(await readFile(join(dir, MANIFEST), 'utf8')) as Manifest;
    return parsed.models ? parsed : { models: {} };
  } catch {
    // A missing or unparseable manifest is not fatal: it only ever caches what
    // can be recomputed from the files themselves.
    return { models: {} };
  }
}

export async function recordInstall(dir: string, spec: ModelSpec): Promise<void> {
  const manifest = await readManifest(dir);
  const info = await stat(modelPath(dir, spec));
  manifest.models[spec.id] = {
    bytes: info.size,
    sha256: spec.sha256,
    mtimeMs: info.mtimeMs,
    installedAt: new Date().toISOString(),
  };
  await writeFile(join(dir, MANIFEST), JSON.stringify(manifest, null, 2) + '\n');
}

async function forgetInstall(dir: string, spec: ModelSpec): Promise<void> {
  const manifest = await readManifest(dir);
  delete manifest.models[spec.id];
  await writeFile(join(dir, MANIFEST), JSON.stringify(manifest, null, 2) + '\n');
}

export type Status =
  | { state: 'missing' }
  | { state: 'installed'; bytes: number }
  | { state: 'corrupt'; detail: string };

/** Reports what is in the cache, for the `model` subcommands. */
export async function inspect(dir: string, spec: ModelSpec): Promise<Status> {
  let fh;
  try {
    fh = await openModel(dir, spec);
  } catch {
    return { state: 'missing' };
  }
  try {
    const info = await fh.stat();
    const size = sizeMismatch(spec, info.size);
    if (size) return { state: 'corrupt', detail: size };
    if (await trusted(dir, spec, info)) return { state: 'installed', bytes: info.size };

    const actual = await hashFile(fh);
    if (actual !== spec.sha256) {
      return { state: 'corrupt', detail: `expected sha256 ${spec.sha256}, found ${actual}` };
    }
    return { state: 'installed', bytes: info.size };
  } finally {
    await fh.close();
  }
}

/** The file is there. Whether it is the right file is `loadModel`'s decision. */
export async function exists(dir: string, spec: ModelSpec): Promise<boolean> {
  try {
    await stat(modelPath(dir, spec));
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads a model, refusing to hand back bytes that failed verification. The file
 * is read exactly once and hashed from that buffer, rather than streamed a
 * second time to check what the read already has in memory.
 */
export async function loadModel(dir: string, spec: ModelSpec): Promise<Uint8Array> {
  let fh;
  try {
    fh = await openModel(dir, spec);
  } catch {
    throw corrupt(spec, 'the file is missing');
  }
  try {
    const info = await fh.stat();
    const size = sizeMismatch(spec, info.size);
    if (size) throw corrupt(spec, size);

    const skipHash = await trusted(dir, spec, info);
    const bytes = new Uint8Array(await fh.readFile());
    if (!skipHash) {
      const actual = createHash('sha256').update(bytes).digest('hex');
      if (actual !== spec.sha256) {
        throw corrupt(spec, `expected sha256 ${spec.sha256}, found ${actual}`);
      }
    }
    return bytes;
  } finally {
    await fh.close();
  }
}

function corrupt(spec: ModelSpec, detail: string): IntegrityError {
  return new IntegrityError(
    `cached ${spec.filename} does not match the pinned artifact (${detail}); ` +
      `run "slash-ascii model remove ${spec.id}" and install it again`,
  );
}

function sizeMismatch(spec: ModelSpec, actual: number): string | null {
  return actual === spec.bytes ? null : `expected ${spec.bytes} bytes, found ${actual}`;
}

/** Whether the manifest already vouches for this exact file, hash and all. */
async function trusted(dir: string, spec: ModelSpec, info: { size: number; mtimeMs: number }): Promise<boolean> {
  if (info.size <= REHASH_LIMIT_BYTES) return false;
  const entry = (await readManifest(dir)).models[spec.id];
  return (
    entry?.sha256 === spec.sha256 && entry.bytes === info.size && entry.mtimeMs === info.mtimeMs
  );
}

export async function removeModel(dir: string, spec: ModelSpec): Promise<boolean> {
  try {
    await unlink(modelPath(dir, spec));
  } catch {
    return false;
  }
  await forgetInstall(dir, spec);
  return true;
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

async function hashFile(fh: FileHandle): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(fh.createReadStream({ autoClose: false }), hash);
  return hash.digest('hex');
}
