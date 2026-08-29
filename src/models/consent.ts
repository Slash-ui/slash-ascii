import { createInterface } from 'node:readline/promises';
import type { ModelSpec } from './registry.js';
import { formatBytes } from './registry.js';
import { tildify } from './cache.js';

export type PromptFn = (question: string) => Promise<boolean>;

export interface ConsentEnv {
  /**
   * Both halves of the exchange need a terminal: the question goes to stderr and
   * the answer comes from stdin. In a pipeline neither is available.
   */
  interactive: boolean;
  assumeYes: boolean;
  offline: boolean;
  /** Model ids already approved, from the config file. */
  consented: readonly string[];
  prompt: PromptFn;
  write: (text: string) => void;
}

export type Decision = { kind: 'proceed' } | { kind: 'declined' } | { kind: 'blocked'; reason: string };

export function consentMessage(spec: ModelSpec, destination: string): string {
  return `Background removal needs a segmentation model. It is not bundled with
this tool and has not been downloaded yet.

  Model      ${spec.name}
  Size       ${formatBytes(spec.bytes)}
  License    ${spec.license}
  Source     ${spec.sourceName}
  Saves to   ${tildify(destination)}

Why this is needed: separating a subject from its background requires a
trained saliency model. Every other feature of this tool runs without one.

This is a one-time download. It will be verified against a pinned
SHA-256 checksum before use.

To skip it, run again without --remove-bg and the whole image will be
converted as-is.
`;
}

function manualInstructions(spec: ModelSpec): string {
  return `Install it with:
  slash-ascii model install ${spec.id}

On a machine with no network access, copy the file over and run:
  slash-ascii model install ${spec.id} --from ./${spec.filename}
`;
}

export async function requestConsent(
  spec: ModelSpec,
  destination: string,
  env: ConsentEnv,
): Promise<Decision> {
  // Offline is a hard promise and outranks every form of pre-approval.
  if (env.offline) {
    return {
      kind: 'blocked',
      reason: `${spec.filename} is not installed and offline mode forbids fetching it.\n\n${manualInstructions(spec)}`,
    };
  }
  if (env.assumeYes || env.consented.includes(spec.id)) return { kind: 'proceed' };

  if (!env.interactive) {
    return {
      kind: 'blocked',
      reason: `${spec.filename} is not installed and there is no terminal to ask for permission.\n\n${consentMessage(spec, destination)}\n${manualInstructions(spec)}`,
    };
  }

  env.write(consentMessage(spec, destination) + '\n');
  return (await env.prompt('Download now? [y/N] ')) ? { kind: 'proceed' } : { kind: 'declined' };
}

/** A bare Enter is a no, and so is anything that is not clearly a yes. */
export function isAffirmative(answer: string): boolean {
  return /^y(es)?$/i.test(answer.trim());
}

export function ttyPrompt(): PromptFn {
  return async (question) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    try {
      return isAffirmative(await rl.question(question));
    } finally {
      rl.close();
    }
  };
}
