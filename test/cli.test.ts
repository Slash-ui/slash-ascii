import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { withTempDir } from './helpers.js';

const run = promisify(execFile);
const CLI = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

interface Result {
  code: number;
  stdout: string;
  stderr: string;
}

/** Runs the CLI as a real process, because exit codes are part of its contract. */
async function cli(args: string[]): Promise<Result> {
  try {
    const { stdout, stderr } = await run(process.execPath, ['--import', 'tsx', CLI, ...args], {
      maxBuffer: 8 * 1024 * 1024,
    });
    return { code: 0, stdout, stderr };
  } catch (err) {
    const failure = err as { code?: number; stdout: string; stderr: string };
    return { code: failure.code ?? 1, stdout: failure.stdout, stderr: failure.stderr };
  }
}

describe('the command line', () => {
  it('converts an image and exits cleanly', async () => {
    const result = await cli([fixture('shapes.png'), '--width', '24', '--format', 'txt']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('@');
  });

  it('rejects an unknown option value with exit 1', async () => {
    const result = await cli([fixture('shapes.png'), '--format', 'nope']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('must be one of');
  });

  it('reports an unreadable input with exit 1', async () => {
    const result = await cli(['no-such-file.png']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('ENOENT');
  });

  it('reports an undecodable input with exit 2', async () => {
    const result = await cli([fixture('../helpers.ts')]);
    expect(result.code).toBe(2);
  });

  it('exits 3 rather than hanging when a model is needed and nobody can be asked', async () => {
    await withTempDir(async (dir) => {
      const result = await cli([fixture('subject.png'), '--remove-bg', '--model-dir', dir]);
      expect(result.code).toBe(3);
      expect(result.stderr).toContain('slash-ascii model install lite');
      expect(result.stdout).toBe('');
    });
  });

  it('exits 3 in offline mode without attempting a request', async () => {
    await withTempDir(async (dir) => {
      const result = await cli([
        fixture('subject.png'),
        '--remove-bg',
        '--offline',
        '--model-dir',
        dir,
      ]);
      expect(result.code).toBe(3);
      expect(result.stderr).toContain('offline');
    });
  });

  it('prints the model directory it would use', async () => {
    const result = await cli(['model', 'path', '--model-dir', '/tmp/somewhere']);
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe('/tmp/somewhere');
  });

  it('shows the pinned checksum and licence for a model', async () => {
    const result = await cli(['model', 'info', 'lite']);
    expect(result.stdout).toContain('Apache-2.0');
    expect(result.stdout).toContain('309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8');
  });

  it('rejects an unknown model id', async () => {
    const result = await cli(['model', 'info', 'medium']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('unknown model');
  });
});
