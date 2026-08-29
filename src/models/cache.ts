import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
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
  filename: string;
  bytes: number;
  sha256: string;
  mtimeMs: number;
  installedAt: string;
}

export interface Manifest {
  models: Record<string, ManifestEntry>;
}

/** `--model-dir`, then the environment, then the per-OS cache directory. */
export function resolveModelDir(override?: string): string {
  if (override) return override;
  const fromEnv = process.env.SLASH_ASCII_MODEL_DIR;
  if (fromEnv) return fromEnv;
  return join(envPaths('slash-ascii', { suffix: '' }).cache, 'models');
}

export function modelPath(dir: string, spec: ModelSpec): string {
  return join(dir, spec.filename);
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
    filename: spec.filename,
    bytes: info.size,
    sha256: spec.sha256,
    mtimeMs: info.mtimeMs,
    installedAt: new Date().toISOString(),
  };
  await writeFile(join(dir, MANIFEST), JSON.stringify(manifest, null, 2) + '\n');
}

export async function forgetInstall(dir: string, spec: ModelSpec): Promise<void> {
  const manifest = await readManifest(dir);
  delete manifest.models[spec.id];
  await writeFile(join(dir, MANIFEST), JSON.stringify(manifest, null, 2) + '\n');
}

export type Status =
  | { state: 'missing' }
  | { state: 'installed'; bytes: number }
  | { state: 'corrupt'; detail: string };

export async function inspect(dir: string, spec: ModelSpec): Promise<Status> {
  let info;
  try {
    info = await stat(modelPath(dir, spec));
  } catch {
    return { state: 'missing' };
  }
  if (info.size !== spec.bytes) {
    return { state: 'corrupt', detail: `expected ${spec.bytes} bytes, found ${info.size}` };
  }

  const entry = (await readManifest(dir)).models[spec.id];
  const trusted =
    info.size > REHASH_LIMIT_BYTES &&
    entry?.sha256 === spec.sha256 &&
    entry.bytes === info.size &&
    entry.mtimeMs === info.mtimeMs;
  if (trusted) return { state: 'installed', bytes: info.size };

  const actual = await hashFile(modelPath(dir, spec));
  if (actual !== spec.sha256) {
    return { state: 'corrupt', detail: `expected sha256 ${spec.sha256}, found ${actual}` };
  }
  return { state: 'installed', bytes: info.size };
}

/** Reads a model, refusing to hand back bytes that failed verification. */
export async function loadModel(dir: string, spec: ModelSpec): Promise<Uint8Array> {
  const status = await inspect(dir, spec);
  if (status.state !== 'installed') {
    throw new IntegrityError(
      `cached ${spec.filename} failed verification (${status.state === 'corrupt' ? status.detail : 'file is missing'}); ` +
        `run "slash-ascii model remove ${spec.id}" and install it again`,
    );
  }
  return new Uint8Array(await readFile(modelPath(dir, spec)));
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

export async function hashFile(path: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}
