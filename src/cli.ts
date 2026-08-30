#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { Command, InvalidArgumentError } from 'commander';
import supportsColor from 'supports-color';
import type { ColorMode } from './render/ansi.js';
import type { ColorSetting, FileConfig } from './config.js';
import type { ConvertDeps, ConvertInput, Format } from './options.js';
import type { ConsentEnv } from './models/consent.js';
import type { ModelSpec } from './models/registry.js';
import type { Status } from './models/cache.js';
import { CONVERT_DEFAULTS } from './options.js';
import { CliError, InputError } from './errors.js';
import { createSegmenter } from './segment/infer.js';
import { downloadModel, installFromFile } from './models/download.js';
import { ensureModel } from './models/ensure.js';
import { formatBytes, getModel, MODEL_IDS, MODELS } from './models/registry.js';
import { inspect, modelPath, removeModel, resolveModelDir, tildify } from './models/cache.js';
import { loadConfig } from './config.js';
import { loadRuntime } from './segment/runtime.js';
import { progressBar } from './progress.js';
import { ttyPrompt } from './models/consent.js';
import type { TransferOptions } from './models/download.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

const CHARSETS = ['ascii', 'blocks', 'braille'] as const;
const FORMATS = ['ansi', 'txt', 'html', 'svg'] as const;
const COLORS = ['auto', 'true', '256', 'mono'] as const;

/** Everything the config file may hold, plus the flags that only exist on the command line. */
type Settings = FileConfig & { output?: string; yes?: boolean; from?: string };

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
    .option('--line-art', 'keep hairlines: no median filter, lower coverage cutoff')
    .option('--alpha-cutoff <n>', 'coverage a cell needs to paint, 0 to 1 (default: 0.5)', fraction)
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

  // The image stack is a good fraction of startup, and the model subcommands
  // never touch it, so it is pulled in only once there is an image to convert.
  const [{ convert }, { readInput }] = await Promise.all([
    import('./pipeline/run.js'),
    import('./pipeline/decode.js'),
  ]);
  const input = await readInput(source);

  const options: ConvertInput = {
    width: settings.width,
    height: settings.height,
    charAspect: settings.charAspect,
    charset: settings.charset && oneOf(settings.charset, CHARSETS, 'charset'),
    ramp: settings.ramp,
    invert: settings.invert,
    denoise: settings.denoise,
    edges: settings.edges,
    lineArt: settings.lineArt,
    alphaCutoff: settings.alphaCutoff,
    threshold: settings.threshold,
    format: settings.format && oneOf(settings.format, FORMATS, 'format'),
    terminalCols: process.stdout.columns,
  };
  options.color = resolveColor(
    settings.color && oneOf(settings.color, COLORS, 'color'),
    options.format ?? CONVERT_DEFAULTS.format,
    Boolean(settings.output),
  );

  const deps: ConvertDeps = { warn };
  if (settings.removeBg) {
    const spec = getModel(settings.model ?? 'lite');
    const model = await withProgress(`downloading ${spec.filename}`, (transfer) =>
      ensureModel({ spec, dir: modelDir(settings), consent: consentEnv(settings), transfer }),
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
    .action(async (id: string, _options: unknown, command: Command) => {
      const settings = await settingsFor(command);
      const spec = getModel(id);
      const dir = modelDir(settings);
      const status = await inspect(dir, spec);
      if (status.state === 'installed') {
        process.stdout.write(`${spec.filename} is already installed at ${tildify(modelPath(dir, spec))}\n`);
        return;
      }

      if (settings.from) {
        await installFromFile(spec, dir, settings.from);
      } else {
        if (isOffline(settings)) {
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
    .action(async (_options: unknown, command: Command) => {
      const dir = modelDir(await settingsFor(command));
      process.stdout.write(`${tildify(dir)}\n`);
      for (const spec of Object.values(MODELS)) {
        const status = await inspect(dir, spec);
        process.stdout.write(
          `  ${spec.id.padEnd(5)} ${spec.filename.padEnd(12)} ${formatBytes(spec.bytes).padStart(9)}  ${statusLabel(status, false)}\n`,
        );
      }
    });

  model
    .command('remove <id>')
    .description('delete a cached model')
    .option('--model-dir <path>', 'where models are stored')
    .action(async (id: string, _options: unknown, command: Command) => {
      const spec = getModel(id);
      const dir = modelDir(await settingsFor(command));
      const removed = await removeModel(dir, spec);
      process.stdout.write(
        removed ? `removed ${tildify(modelPath(dir, spec))}\n` : `${spec.filename} was not installed\n`,
      );
    });

  model
    .command('info <id>')
    .description('show the pinned url, size, checksum and licence')
    .option('--model-dir <path>', 'where models are stored')
    .action(async (id: string, _options: unknown, command: Command) => {
      const spec = getModel(id);
      const dir = modelDir(await settingsFor(command));
      process.stdout.write(describe(spec, dir, await inspect(dir, spec)));
    });

  model
    .command('path')
    .description('print the directory models are stored in')
    .option('--model-dir <path>', 'where models are stored')
    .action(async (_options: unknown, command: Command) => {
      process.stdout.write(modelDir(await settingsFor(command)) + '\n');
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
    `  status    ${statusLabel(status, true)}`,
    '',
  ].join('\n');
}

/** The listing stays one line per model; the reason belongs in `model info`. */
function statusLabel(status: Status, detailed: boolean): string {
  if (status.state === 'installed') return 'installed';
  if (status.state === 'corrupt') return detailed ? `corrupt (${status.detail})` : 'corrupt';
  return 'not installed';
}

/**
 * Flags beat the config file, which beats the defaults. Resolved the same way
 * for every command, so `model install` honours a configured model directory
 * and offline setting exactly as a conversion does.
 */
async function settingsFor(command: Command): Promise<Settings> {
  return { ...(await loadConfig()), ...typedFlags(command) };
}

/**
 * Only values the user actually typed, so a config file is not overridden by
 * commander's own defaults for flags nobody passed. Ancestors are included
 * because an option declared on the root program is parsed wherever it appears,
 * even after a subcommand name.
 */
function typedFlags(command: Command): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let node: Command | null = command; node; node = node.parent) {
    const values = node.opts<Record<string, unknown>>();
    for (const key of Object.keys(values)) {
      if (!(key in out) && node.getOptionValueSource(key) === 'cli') out[key] = values[key];
    }
  }
  return out;
}

function modelDir(settings: Settings): string {
  return resolveModelDir(settings.modelDir ?? process.env.SLASH_ASCII_MODEL_DIR);
}

function isOffline(settings: Settings): boolean {
  return Boolean(settings.offline) || process.env.SLASH_ASCII_OFFLINE === '1';
}

function consentEnv(settings: Settings): ConsentEnv {
  return {
    interactive: Boolean(process.stdin.isTTY && process.stderr.isTTY),
    assumeYes: Boolean(settings.yes) || process.env.SLASH_ASCII_ASSUME_YES === '1',
    offline: isOffline(settings),
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

/**
 * Answers what the destination can display. Whether a format can carry colour at
 * all is the renderer's business and is settled inside `convert`.
 */
function resolveColor(setting: ColorSetting | undefined, format: Format, toFile: boolean): ColorMode {
  if (setting && setting !== 'auto') return setting;
  // Only ansi is aimed at a terminal; the document formats carry their own colour.
  if (format !== 'ansi') return 'true';
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

/** A share of something, so both ends are meaningful and zero is allowed. */
function fraction(raw: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new InvalidArgumentError('expected a number between 0 and 1');
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
