import type { ConsentEnv } from './consent.js';
import type { ModelSpec } from './registry.js';
import type { TransferOptions } from './download.js';
import { IntegrityError, ModelUnavailableError } from '../errors.js';
import { downloadModel } from './download.js';
import { inspect, loadModel, modelPath } from './cache.js';
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
  const status = await inspect(dir, spec);

  if (status.state === 'installed') return loadModel(dir, spec);
  if (status.state === 'corrupt') {
    throw new IntegrityError(
      `cached ${spec.filename} does not match the pinned artifact (${status.detail}); ` +
        `run "slash-ascii model remove ${spec.id}" and install it again`,
    );
  }

  const decision = await requestConsent(spec, modelPath(dir, spec), consent);
  if (decision.kind === 'declined') return null;
  if (decision.kind === 'blocked') throw new ModelUnavailableError(decision.reason);

  await downloadModel(spec, dir, transfer);
  return loadModel(dir, spec);
}
