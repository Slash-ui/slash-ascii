import type { Raster } from '../pipeline/decode.js';
import type { MaskProvider } from '../pipeline/run.js';
import type { Runtime } from './runtime.js';

/** ImageNet statistics, which is what U^2-Net was trained against. */
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

export async function createSegmenter(
  model: Uint8Array,
  inputSize: number,
  runtime: Runtime,
): Promise<MaskProvider> {
  const session = await runtime.createSession(model);
  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];

  return async (raster: Raster): Promise<Float32Array> => {
    const input = preprocess(raster, inputSize);
    const results = await session.run({
      [inputName]: runtime.tensor(input, [1, 3, inputSize, inputSize]),
    });
    // U^2-Net emits one map per decoder stage, finest first.
    const saliency = normalise(results[outputName].data);
    return upsample(saliency, inputSize, inputSize, raster.width, raster.height);
  };
}

/** Interleaved RGBA to normalised planar RGB at the size the network expects. */
function preprocess(raster: Raster, size: number): Float32Array {
  const out = new Float32Array(3 * size * size);
  const plane = size * size;
  const scaleX = raster.width / size;
  const scaleY = raster.height / size;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = areaMean(raster, x * scaleX, y * scaleY, scaleX, scaleY);
      const i = y * size + x;
      out[i] = (r / 255 - MEAN[0]) / STD[0];
      out[plane + i] = (g / 255 - MEAN[1]) / STD[1];
      out[2 * plane + i] = (b / 255 - MEAN[2]) / STD[2];
    }
  }
  return out;
}

/**
 * Averaging over the source rectangle rather than point sampling: the input is
 * usually several times larger than 320px, and dropping pixels there produces
 * aliasing that the mask inherits.
 */
function areaMean(raster: Raster, x0: number, y0: number, w: number, h: number): [number, number, number] {
  const startX = Math.max(0, Math.floor(x0));
  const startY = Math.max(0, Math.floor(y0));
  const endX = Math.min(raster.width, Math.max(startX + 1, Math.ceil(x0 + w)));
  const endY = Math.min(raster.height, Math.max(startY + 1, Math.ceil(y0 + h)));

  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const p = (y * raster.width + x) * 4;
      r += raster.data[p];
      g += raster.data[p + 1];
      b += raster.data[p + 2];
      n++;
    }
  }
  return n === 0 ? [0, 0, 0] : [r / n, g / n, b / n];
}

/** Stretches the saliency map to the full 0..1 range, as the reference implementation does. */
function normalise(data: Float32Array): Float32Array {
  let min = Infinity;
  let max = -Infinity;
  for (const value of data) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const span = max - min;
  const out = new Float32Array(data.length);
  if (span <= 0) return out;
  for (let i = 0; i < data.length; i++) out[i] = (data[i] - min) / span;
  return out;
}

function upsample(
  mask: Float32Array,
  w: number,
  h: number,
  dstW: number,
  dstH: number,
): Float32Array {
  const out = new Float32Array(dstW * dstH);
  for (let y = 0; y < dstH; y++) {
    const sy = Math.min(h - 1, Math.max(0, ((y + 0.5) * h) / dstH - 0.5));
    const y0 = Math.floor(sy);
    const y1 = Math.min(h - 1, y0 + 1);
    const fy = sy - y0;

    for (let x = 0; x < dstW; x++) {
      const sx = Math.min(w - 1, Math.max(0, ((x + 0.5) * w) / dstW - 0.5));
      const x0 = Math.floor(sx);
      const x1 = Math.min(w - 1, x0 + 1);
      const fx = sx - x0;

      const top = mask[y0 * w + x0] * (1 - fx) + mask[y0 * w + x1] * fx;
      const bottom = mask[y1 * w + x0] * (1 - fx) + mask[y1 * w + x1] * fx;
      out[y * dstW + x] = top * (1 - fy) + bottom * fy;
    }
  }
  return out;
}
