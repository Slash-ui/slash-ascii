import type { MaskProvider } from '../options.js';
import type { Raster } from '../raster.js';
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

/**
 * Interleaved RGBA to normalised planar RGB at the size the network expects.
 * Each output pixel averages the source rectangle that maps onto it: the input
 * is usually several times larger than 320px, and point sampling there produces
 * aliasing that the mask inherits.
 */
function preprocess(raster: Raster, size: number): Float32Array {
  const out = new Float32Array(3 * size * size);
  const plane = size * size;
  const scaleX = raster.width / size;
  const scaleY = raster.height / size;

  // Column spans depend only on x, so they are worked out once instead of once
  // per row.
  const from = new Int32Array(size);
  const to = new Int32Array(size);
  for (let x = 0; x < size; x++) {
    const start = Math.min(raster.width - 1, Math.max(0, Math.floor(x * scaleX)));
    from[x] = start;
    to[x] = Math.min(raster.width, Math.max(start + 1, Math.ceil((x + 1) * scaleX)));
  }

  for (let y = 0; y < size; y++) {
    const rowStart = Math.min(raster.height - 1, Math.max(0, Math.floor(y * scaleY)));
    const rowEnd = Math.min(raster.height, Math.max(rowStart + 1, Math.ceil((y + 1) * scaleY)));

    for (let x = 0; x < size; x++) {
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let n = 0;
      for (let sy = rowStart; sy < rowEnd; sy++) {
        const row = sy * raster.width;
        for (let sx = from[x]; sx < to[x]; sx++) {
          const p = (row + sx) * 4;
          sr += raster.data[p];
          sg += raster.data[p + 1];
          sb += raster.data[p + 2];
          n++;
        }
      }

      const i = y * size + x;
      out[i] = (sr / n / 255 - MEAN[0]) / STD[0];
      out[plane + i] = (sg / n / 255 - MEAN[1]) / STD[1];
      out[2 * plane + i] = (sb / n / 255 - MEAN[2]) / STD[2];
    }
  }
  return out;
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
  // The column mapping is the same for every row, so it is built once.
  const left = new Int32Array(dstW);
  const right = new Int32Array(dstW);
  const weight = new Float32Array(dstW);
  for (let x = 0; x < dstW; x++) {
    const sx = Math.min(w - 1, Math.max(0, ((x + 0.5) * w) / dstW - 0.5));
    const x0 = Math.floor(sx);
    left[x] = x0;
    right[x] = Math.min(w - 1, x0 + 1);
    weight[x] = sx - x0;
  }

  for (let y = 0; y < dstH; y++) {
    const sy = Math.min(h - 1, Math.max(0, ((y + 0.5) * h) / dstH - 0.5));
    const y0 = Math.floor(sy);
    const fy = sy - y0;
    const rowTop = y0 * w;
    const rowBottom = Math.min(h - 1, y0 + 1) * w;
    const target = y * dstW;

    for (let x = 0; x < dstW; x++) {
      const x0 = left[x];
      const x1 = right[x];
      const fx = weight[x];
      const top = mask[rowTop + x0] * (1 - fx) + mask[rowTop + x1] * fx;
      const bottom = mask[rowBottom + x0] * (1 - fx) + mask[rowBottom + x1] * fx;
      out[target + x] = top * (1 - fy) + bottom * fy;
    }
  }
  return out;
}
