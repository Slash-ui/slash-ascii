import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const fixturePath = (name: string): string =>
  fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

export const fixture = (name: string): Promise<Buffer> => readFile(fixturePath(name));

/** How many cells paint something, across a whole rendering. */
export const inked = (art: string): number =>
  [...art].filter((ch) => ch !== ' ' && ch !== '\n').length;

export async function withTempDir<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'slash-ascii-test-'));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
