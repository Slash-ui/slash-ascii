import type { ConsentEnv } from './consent.js';
import type { ModelSpec } from './registry.js';
import type { TransferOptions } from './download.js';
import { ModelUnavailableError } from '../errors.js';
import { downloadModel } from './download.js';
import { exists, loadModel, modelPath } from './cache.js';
import { requestConsent } from './consent.js';

export interface EnsureOptions {
  spec: ModelSpec;
  dir: string;
  consent: ConsentEnv;
  transfer?: TransferOptions;
}

/**
 * Returns the verified model bytes, or null when the user declined. Declining is
 * an ordinary outcome, not an error, so it is not signalled by throwing.
 */
export async function ensureModel(options: EnsureOptions): Promise<Uint8Array | null> {
  const { spec, dir, consent, transfer } = options;
  // Anything already on disk goes through loadModel, which owns the verification
  // and the message that comes with failing it.
  if (await exists(dir, spec)) return loadModel(dir, spec);

  const decision = await requestConsent(spec, modelPath(dir, spec), consent);
  if (decision.kind === 'declined') return null;
  if (decision.kind === 'blocked') throw new ModelUnavailableError(decision.reason);

  await downloadModel(spec, dir, transfer);
  return loadModel(dir, spec);
}
