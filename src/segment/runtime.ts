import { createRequire } from 'node:module';
import { dirname } from 'node:path';

export interface OrtValue {
  data: Float32Array;
}

export interface OrtSession {
  inputNames: readonly string[];
  outputNames: readonly string[];
  run(feeds: Record<string, unknown>): Promise<Record<string, OrtValue>>;
}

export type Backend = 'node' | 'wasm';

export interface Runtime {
  backend: Backend;
  createSession(model: Uint8Array): Promise<OrtSession>;
  tensor(data: Float32Array, dims: number[]): unknown;
}

/** The slice of onnxruntime this tool uses. Both packages satisfy it. */
interface OrtModule {
  InferenceSession: { create(model: Uint8Array, options?: unknown): Promise<OrtSession> };
  Tensor: new (type: 'float32', data: Float32Array, dims: number[]) => unknown;
  env: { wasm: { numThreads: number; wasmPaths?: string }; logLevel?: string };
}

/**
 * onnxruntime-node is roughly ten times faster on the full model but ships over
 * 100 MB of platform binaries, which would be a poor trade for every user of a
 * feature that is off by default. It is an optional peer dependency: used when
 * present, ignored when not.
 */
export async function loadRuntime(): Promise<Runtime> {
  const native = await tryImport('onnxruntime-node');
  if (native) return wrap(native, 'node');

  const web = (await import('onnxruntime-web')) as unknown as OrtModule;
  web.env.wasm.numThreads = 1;
  web.env.logLevel = 'error';
  const dist = wasmDirectory();
  if (dist) web.env.wasm.wasmPaths = dist;
  return wrap(web, 'wasm');
}

async function tryImport(specifier: string): Promise<OrtModule | null> {
  try {
    return (await import(specifier)) as unknown as OrtModule;
  } catch {
    // Not installed, or installed without a binary for this platform. Either way
    // the WASM build is the answer, so there is nothing to report.
    return null;
  }
}

/**
 * Pins the WASM binaries to the copy inside node_modules. Without this, some
 * onnxruntime-web builds fall back to a CDN, and this tool does not touch the
 * network unless the user asked it to.
 */
function wasmDirectory(): string | null {
  try {
    const require = createRequire(import.meta.url);
    return dirname(require.resolve('onnxruntime-web/ort-wasm-simd-threaded.wasm')) + '/';
  } catch {
    // Unusual install layouts may not expose that subpath. The default resolution
    // reads from disk too, so carrying on is safe.
    return null;
  }
}

function wrap(ort: OrtModule, backend: Backend): Runtime {
  return {
    backend,
    createSession: (model) =>
      ort.InferenceSession.create(
        model,
        backend === 'wasm' ? { executionProviders: ['wasm'] } : undefined,
      ),
    tensor: (data, dims) => new ort.Tensor('float32', data, dims),
  };
}
