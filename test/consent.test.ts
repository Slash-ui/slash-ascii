import { describe, expect, it, vi } from 'vitest';
import type { ConsentEnv } from '../src/models/consent.js';
import { consentMessage, isAffirmative, requestConsent } from '../src/models/consent.js';
import { MODELS } from '../src/models/registry.js';

const spec = MODELS.lite;
const destination = '/cache/slash-ascii/models/u2netp.onnx';

function env(overrides: Partial<ConsentEnv> = {}): ConsentEnv {
  return {
    interactive: true,
    assumeYes: false,
    offline: false,
    consented: [],
    prompt: async () => false,
    write: () => {},
    ...overrides,
  };
}

describe('consent', () => {
  it('asks before downloading and takes no for an answer', async () => {
    const write = vi.fn();
    const prompt = vi.fn(async () => false);
    const decision = await requestConsent(spec, destination, env({ write, prompt }));

    expect(decision).toEqual({ kind: 'declined' });
    expect(prompt).toHaveBeenCalledOnce();
    expect(write.mock.calls[0][0]).toContain('Apache-2.0');
  });

  it('proceeds on a yes', async () => {
    const decision = await requestConsent(spec, destination, env({ prompt: async () => true }));
    expect(decision).toEqual({ kind: 'proceed' });
  });

  it('skips the question when the user pre-approved it', async () => {
    const prompt = vi.fn(async () => false);
    expect(await requestConsent(spec, destination, env({ assumeYes: true, prompt }))).toEqual({
      kind: 'proceed',
    });
    expect(await requestConsent(spec, destination, env({ consented: ['lite'], prompt }))).toEqual({
      kind: 'proceed',
    });
    expect(prompt).not.toHaveBeenCalled();
  });

  it('does not hang without a terminal, and says how to install by hand', async () => {
    const prompt = vi.fn(async () => true);
    const decision = await requestConsent(spec, destination, env({ interactive: false, prompt }));

    expect(decision.kind).toBe('blocked');
    expect(prompt).not.toHaveBeenCalled();
    if (decision.kind === 'blocked') {
      expect(decision.reason).toContain('slash-ascii model install lite');
    }
  });

  it('refuses in offline mode even when downloads were pre-approved', async () => {
    const decision = await requestConsent(
      spec,
      destination,
      env({ offline: true, assumeYes: true, consented: ['lite'] }),
    );
    expect(decision.kind).toBe('blocked');
    if (decision.kind === 'blocked') expect(decision.reason).toContain('offline');
  });

  it('states size, licence, source and destination up front', () => {
    const message = consentMessage(spec, destination);
    expect(message).toContain('4.6 MB');
    expect(message).toContain('Apache-2.0');
    expect(message).toContain('github.com/danielgatis/rembg');
    expect(message).toContain(destination);
    expect(message).toContain('without --remove-bg');
  });

  it('treats anything that is not a clear yes as a no', () => {
    expect(['y', 'Y', 'yes', 'YES', ' y '].every(isAffirmative)).toBe(true);
    expect(['', ' ', 'n', 'no', 'yep', 'sure', 'ok'].some(isAffirmative)).toBe(false);
  });
});
