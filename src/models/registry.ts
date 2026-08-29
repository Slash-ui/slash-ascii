import { InputError } from '../errors.js';

export type ModelId = 'lite' | 'full';

export interface ModelSpec {
  id: ModelId;
  /** Name the upstream project uses, shown in prompts. */
  name: string;
  filename: string;
  url: string;
  /** Exact size of the pinned artifact. A mismatch is an integrity failure. */
  bytes: number;
  sha256: string;
  license: string;
  sourceName: string;
  summary: string;
  /** Square input the network expects. */
  inputSize: number;
}

/**
 * Both tiers are U^2-Net under Apache-2.0. The weights are not redistributed
 * here; the tool fetches them from their original host when the user says yes.
 *
 * RMBG-1.4 produces better mattes and is deliberately absent: it is licensed for
 * non-commercial use only, which would quietly push that restriction onto anyone
 * embedding this tool.
 */
export const MODELS: Record<ModelId, ModelSpec> = {
  lite: {
    id: 'lite',
    name: 'u2netp (U^2-Net lite)',
    filename: 'u2netp.onnx',
    url: 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx',
    bytes: 4_574_861,
    sha256: '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8',
    license: 'Apache-2.0',
    sourceName: 'github.com/danielgatis/rembg  (releases)',
    summary: 'General subjects, fast',
    inputSize: 320,
  },
  full: {
    id: 'full',
    name: 'u2net (U^2-Net)',
    filename: 'u2net.onnx',
    url: 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx',
    bytes: 175_997_641,
    sha256: '8d10d2f3bb75ae3b6d527c77944fc5e7dcd94b29809d47a739a7a728a912b491',
    license: 'Apache-2.0',
    sourceName: 'github.com/danielgatis/rembg  (releases)',
    summary: 'Fine edges, hair, complex outlines',
    inputSize: 320,
  },
};

export const MODEL_IDS = Object.keys(MODELS) as ModelId[];

export function getModel(id: string): ModelSpec {
  if (!isModelId(id)) {
    throw new InputError(`unknown model "${id}", expected one of ${MODEL_IDS.join(', ')}`);
  }
  return MODELS[id];
}

export function isModelId(id: string): id is ModelId {
  return Object.hasOwn(MODELS, id);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1000 * 1000) return `${(bytes / 1000).toFixed(1)} kB`;
  return `${(bytes / 1000 / 1000).toFixed(1)} MB`;
}
