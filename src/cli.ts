#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { Command, InvalidArgumentError } from 'commander';
import supportsColor from 'supports-color';
import type { ColorMode } from './render/ansi.js';
import type { ColorSetting, FileConfig } from './config.js';
import type { ConsentEnv } from './models/consent.js';
import type { ConvertDeps, ConvertOptions, Format } from './pipeline/run.js';
import type { ModelSpec } from './models/registry.js';
import type { Status } from './models/cache.js';
import type { TransferOptions } from './models/download.js';
import { CliError, InputError } from './errors.js';
import { convert } from './pipeline/run.js';
import { createSegmenter } from './segment/infer.js';
import { ensureModel } from './models/ensure.js';
import { downloadModel, installFromFile } from './models/download.js';
import { formatBytes, getModel, MODEL_IDS, MODELS } from './models/registry.js';
import { inspect, modelPath, removeModel, resolveModelDir, tildify } from './models/cache.js';
import { loadConfig } from './config.js';
import { loadRuntime } from './segment/runtime.js';
import { progressBar } from './progress.js';
import { readInput } from './pipeline/decode.js';
import { ttyPrompt } from './models/consent.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

const CHARSETS = ['ascii', 'blocks', 'braille'] as const;
const FORMATS = ['ansi', 'txt', 'html', 'svg'] as const;
const COLORS = ['auto', 'true', '256', 'mono'] as const;

function buildProgram(): Command {
  const program = new Command();
  program
    .name('slash-ascii')
    .description('Convert an image into ASCII art')
    .version(version)
    // -h is the height flag, so help keeps the long form only.
    .helpOption('--help', 'show this help')
    .argument('<input>', 'image file, or - to read from stdin')
    .option('-w, --width <n>', 'width in columns (default: terminal width)', integer)
    .option('-h, --height <n>', 'height in rows (default: derived from the image)', integer)
    .option('--char-aspect <n>', 'cell width divided by cell height (default: 0.5)', number)
    .option('-c, --color <mode>', `one of ${COLORS.join(', ')} (default: auto)`)
    .option('--charset <name>', `one of ${CHARSETS.join(', ')} (default: ascii)`)
    .option('--ramp <chars>', 'ramp characters, darkest first')
    .option('--invert', 'invert the ramp, for light backgrounds')
    .option('--no-edges', 'disable edge-aware character selection')
    .option('--no-denoise', 'skip the median filter')
    .option('--remove-bg', 'keep only the subject (needs a segmentation model)')
    .option('--model <tier>', `one of ${MODEL_IDS.join(', ')} (default: lite)`)
    .option('--threshold <n>', 'mask cutoff between 0 and 1 (default: 0.5)', number)
    .option('--format <fmt>', `one of ${FORMATS.join(', ')} (default: ansi)`)
    .option('-o, --output <file>', 'write to a file instead of stdout')
    .option('--offline', 'never make a network request')
    .option('-y, --yes', 'approve model downloads without asking')
    .option('--model-dir <path>', 'where models are stored')
    .action(runConvert);

  program.addCommand(buildModelCommand());
  return program;
}

async function runConvert(source: string, _options: unknown, command: Command): Promise<void> {
  const settings = await settingsFor(command);
  const input = await readInput(source);

  const options: Partial<ConvertOptions> = {
    width: settings.width,
    height: settings.height,
    charAspect: settings.charAspect,
    charset: settings.charset && oneOf(settings.charset, CHARSETS, 'charset'),
    ramp: settings.ramp,
    invert: settings.invert,
    denoise: settings.denoise,
    edges: settings.edges,
    threshold: settings.threshold,
    format: settings.format && oneOf(settings.format, FORMATS, 'format'),
    terminalCols: process.stdout.columns,
  };
  const format = options.format ?? 'ansi';
  options.color = resolveColor(
    settings.color && oneOf(settings.color, COLORS, 'color'),
    format,
    Boolean(settings.output),
  );

  const deps: ConvertDeps = { warn: (message) => warn(message) };
  if (settings.removeBg) {
    const spec = getModel(settings.model ?? 'lite');
    const model = await withProgress(`downloading ${spec.filename}`, (transfer) =>
      ensureModel({
        spec,
        dir: resolveModelDir(settings.modelDir),
        consent: consentEnv(settings),
        transfer,
      }),
    );
    if (!model) {
      // Declining is a normal answer, so this is a clean exit, not a failure.
      warn('rerun without --remove-bg to convert the whole image');
      return;
    }
    deps.mask = await createSegmenter(model, spec.inputSize, await loadRuntime());
  }

  const text = await convert(input, options, deps);
  if (settings.output) {
    await writeFile(settings.output, text);
  } else {
    await write(text);
  }
}

function buildModelCommand(): Command {
  const model = new Command('model')
    .description('manage the segmentation models')
    .helpOption('--help', 'show this help');

  model
    .command('install <id>')
    .description('download a model, or copy one in with --from')
    .option('--from <file>', 'install from a local file instead of downloading')
    .option('--model-dir <path>', 'where models are stored')
    .option('--offline', 'never make a network request')
    .action(async (id: string, options: { from?: string; modelDir?: string; offline?: boolean }) => {
      const spec = getModel(id);
      const dir = resolveModelDir(options.modelDir);
      const status = await inspect(dir, spec);
      if (status.state === 'installed') {
        process.stdout.write(`${spec.filename} is already installed at ${tildify(modelPath(dir, spec))}\n`);
        return;
      }

      if (options.from) {
        await installFromFile(spec, dir, options.from);
      } else {
        if (options.offline || process.env.SLASH_ASCII_OFFLINE === '1') {
          throw new CliError(
            `offline mode forbids downloading ${spec.filename}; use --from <file> to install a local copy`,
            3,
          );
        }
        // Typing this command is the consent, so there is nothing to ask.
        await withProgress(`downloading ${spec.filename}`, (transfer) =>
          downloadModel(spec, dir, transfer),
        );
      }
      process.stdout.write(
        `installed ${spec.filename} (${formatBytes(spec.bytes)}, sha256 verified) at ${tildify(modelPath(dir, spec))}\n`,
      );
    });

  model
    .command('list')
    .description('show which models are installed')
    .option('--model-dir <path>', 'where models are stored')
    .action(async (options: { modelDir?: string }) => {
      const dir = resolveModelDir(options.modelDir);
      process.stdout.write(`${tildify(dir)}\n`);
      for (const spec of Object.values(MODELS)) {
        const status = await inspect(dir, spec);
        process.stdout.write(
          `  ${spec.id.padEnd(5)} ${spec.filename.padEnd(12)} ${formatBytes(spec.bytes).padStart(9)}  ${statusLabel(status)}\n`,
        );
      }
    });

  model
    .command('remove <id>')
    .description('delete a cached model')
    .option('--model-dir <path>', 'where models are stored')
    .action(async (id: string, options: { modelDir?: string }) => {
      const spec = getModel(id);
      const dir = resolveModelDir(options.modelDir);
      const removed = await removeModel(dir, spec);
      process.stdout.write(
        removed ? `removed ${tildify(modelPath(dir, spec))}\n` : `${spec.filename} was not installed\n`,
      );
    });

  model
    .command('info <id>')
    .description('show the pinned url, size, checksum and licence')
    .option('--model-dir <path>', 'where models are stored')
    .action(async (id: string, options: { modelDir?: string }) => {
      const spec = getModel(id);
      const dir = resolveModelDir(options.modelDir);
      const status = await inspect(dir, spec);
      process.stdout.write(describe(spec, dir, status));
    });

  model
    .command('path')
    .description('print the directory models are stored in')
    .option('--model-dir <path>', 'where models are stored')
    .action((options: { modelDir?: string }) => {
      process.stdout.write(resolveModelDir(options.modelDir) + '\n');
    });

  return model;
}

function describe(spec: ModelSpec, dir: string, status: Status): string {
  return [
    spec.id,
    `  model     ${spec.name}`,
    `  purpose   ${spec.summary}`,
    `  file      ${spec.filename}`,
    `  size      ${formatBytes(spec.bytes)} (${spec.bytes} bytes)`,
    `  sha256    ${spec.sha256}`,
    `  license   ${spec.license}`,
    `  source    ${spec.sourceName}`,
    `  url       ${spec.url}`,
    `  path      ${tildify(modelPath(dir, spec))}`,
    `  status    ${statusLabel(status)}`,
    '',
  ].join('\n');
}

function statusLabel(status: Status): string {
  if (status.state === 'installed') return 'installed';
  if (status.state === 'corrupt') return `corrupt (${status.detail})`;
  return 'not installed';
}

async function settingsFor(command: Command): Promise<FileConfig & { output?: string; yes?: boolean }> {
  return { ...(await loadConfig()), ...overrides(command) };
}

/**
 * Only values the user actually typed, so a config file is not overridden by
 * commander's own defaults for flags nobody passed.
 */
function overrides(command: Command): Record<string, unknown> {
  const values = command.opts<Record<string, unknown>>();
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(values)) {
    if (command.getOptionValueSource(key) === 'cli') out[key] = values[key];
  }
  return out;
}

function consentEnv(settings: FileConfig & { yes?: boolean }): ConsentEnv {
  return {
    interactive: Boolean(process.stdin.isTTY && process.stderr.isTTY),
    assumeYes: Boolean(settings.yes) || process.env.SLASH_ASCII_ASSUME_YES === '1',
    offline: Boolean(settings.offline) || process.env.SLASH_ASCII_OFFLINE === '1',
    consented: settings.consentedModels ?? [],
    prompt: ttyPrompt(),
    write: (text) => process.stderr.write(text),
  };
}

async function withProgress<T>(label: string, run: (options: TransferOptions) => Promise<T>): Promise<T> {
  const bar = progressBar(label, process.stderr);
  if (!bar) return run({});
  let started = false;
  try {
    return await run({
      onProgress: ({ received, total }) => {
        started = true;
        bar.update(received, total);
      },
    });
  } finally {
    if (started) bar.done();
  }
}

function resolveColor(setting: ColorSetting | undefined, format: Format, toFile: boolean): ColorMode {
  if (format === 'txt') return 'mono';
  if (setting && setting !== 'auto') return setting;
  // html and svg carry colour in the document itself; there is no terminal to ask.
  if (format === 'html' || format === 'svg') return 'true';
  if (toFile) return 'mono';
  const level = supportsColor.stdout ? supportsColor.stdout.level : 0;
  if (level >= 3) return 'true';
  if (level === 2) return '256';
  return 'mono';
}

function oneOf<T extends string>(value: string, allowed: readonly T[], name: string): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new InputError(`--${name} must be one of ${allowed.join(', ')}, got "${value}"`);
  }
  return value as T;
}

function integer(raw: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new InvalidArgumentError('expected a positive whole number');
  }
  return value;
}

function number(raw: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new InvalidArgumentError('expected a positive number');
  }
  return value;
}

function warn(message: string): void {
  process.stderr.write(`slash-ascii: ${message}\n`);
}

function write(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    process.stdout.write(text, (err) => (err ? reject(err) : resolve()));
  });
}

// `slash-ascii big.png | head` closes stdout early. That is the pipe working as
// intended, not a failure.
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') process.exit(0);
  throw err;
});

try {
  await buildProgram().parseAsync(process.argv);
} catch (err) {
  if (err instanceof CliError) {
    warn(err.message);
    process.exit(err.exitCode);
  }
  throw err;
}
