import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fixturePath, inked, withTempDir } from './helpers.js';

const run = promisify(execFile);
const CLI = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
// Resolved here rather than passed as a bare specifier: some cases run the CLI
// from a temporary directory, where "tsx" would not resolve.
const TSX = createRequire(import.meta.url).resolve('tsx');

interface Result {
  code: number;
  stdout: string;
  stderr: string;
}

interface Options {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

/** Runs the CLI as a real process, because exit codes are part of its contract. */
async function cli(args: string[], options: Options = {}): Promise<Result> {
  try {
    const { stdout, stderr } = await run(process.execPath, ['--import', TSX, CLI, ...args], {
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, ...options.env },
      cwd: options.cwd,
    });
    return { code: 0, stdout, stderr };
  } catch (err) {
    const failure = err as { code?: number; stdout: string; stderr: string };
    return { code: failure.code ?? 1, stdout: failure.stdout, stderr: failure.stderr };
  }
}

describe('the command line', () => {
  it('converts an image and exits cleanly', async () => {
    const result = await cli([fixturePath('shapes.png'), '--width', '24', '--format', 'txt']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('@');
  });

  it('wires --line-art and --alpha-cutoff through to the conversion', async () => {
    // What the flags mean is settled in convert.test.ts. What is left to check
    // here is that the command line reaches those options at all.
    const args = [fixturePath('hairline.svg'), '--width', '40', '--charset', 'blocks', '--format', 'txt'];
    const [plain, lineArt, strict] = await Promise.all([
      cli(args),
      cli([...args, '--line-art']),
      cli([...args, '--line-art', '--alpha-cutoff', '0.5']),
    ]);
    for (const result of [plain, lineArt, strict]) expect(result.code).toBe(0);
    expect(inked(lineArt.stdout)).toBeGreaterThan(inked(plain.stdout));
    // An explicit cutoff beats the preset that would otherwise have lowered it.
    expect(inked(strict.stdout)).toBeLessThan(inked(lineArt.stdout));
  });

  it('rejects a coverage cutoff outside 0 to 1', async () => {
    const result = await cli([fixturePath('hairline.svg'), '--alpha-cutoff', '2']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('between 0 and 1');
  });

  it('rejects an unknown option value with exit 1', async () => {
    const result = await cli([fixturePath('shapes.png'), '--format', 'nope']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('must be one of');
  });

  it('reports an unreadable input with exit 1', async () => {
    const result = await cli(['no-such-file.png']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('ENOENT');
  });

  it('reports an undecodable input with exit 2', async () => {
    const result = await cli([fixturePath('../helpers.ts')]);
    expect(result.code).toBe(2);
  });

  it('exits 3 rather than hanging when a model is needed and nobody can be asked', async () => {
    await withTempDir(async (dir) => {
      const result = await cli([fixturePath('subject.png'), '--remove-bg', '--model-dir', dir]);
      expect(result.code).toBe(3);
      expect(result.stderr).toContain('slash-ascii model install lite');
      expect(result.stdout).toBe('');
    });
  });

  it('exits 3 in offline mode without attempting a request', async () => {
    await withTempDir(async (dir) => {
      const result = await cli([
        fixturePath('subject.png'),
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

  it('takes the model directory from the environment, and lets the flag win', async () => {
    const fromEnv = await cli(['model', 'path'], {
      env: { SLASH_ASCII_MODEL_DIR: '/tmp/from-env' },
    });
    expect(fromEnv.stdout.trim()).toBe('/tmp/from-env');

    const fromFlag = await cli(['model', 'path', '--model-dir', '/tmp/from-flag'], {
      env: { SLASH_ASCII_MODEL_DIR: '/tmp/from-env' },
    });
    expect(fromFlag.stdout.trim()).toBe('/tmp/from-flag');
  });

  it('applies the config file to the model subcommands, not just to conversions', async () => {
    await withTempDir(async (dir) => {
      await writeFile(
        join(dir, 'slash-ascii.config.json'),
        JSON.stringify({ modelDir: join(dir, 'models'), offline: true }),
      );

      const path = await cli(['model', 'path'], { cwd: dir });
      expect(path.stdout.trim()).toBe(join(dir, 'models'));

      // offline: true in the config has to stop a download the same way the flag does.
      const install = await cli(['model', 'install', 'lite'], { cwd: dir });
      expect(install.code).toBe(3);
      expect(install.stderr).toContain('offline mode forbids');

      const overridden = await cli(['model', 'path', '--model-dir', '/tmp/from-flag'], { cwd: dir });
      expect(overridden.stdout.trim()).toBe('/tmp/from-flag');
    });
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
