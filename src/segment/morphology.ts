export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Cuts a soft saliency map into a binary mask. */
export function threshold(mask: Float32Array, level: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) out[i] = mask[i] >= level ? 1 : 0;
  return out;
}

/**
 * Square structuring elements are separable, so a horizontal pass followed by a
 * vertical one gives the same result as the 2D window at a fraction of the work.
 */
function morph(bin: Uint8Array, w: number, h: number, radius: number, dilate: boolean): Uint8Array {
  if (radius < 1) return bin;
  const seed = dilate ? 0 : 1;
  const pick = dilate ? (a: number, b: number) => a | b : (a: number, b: number) => a & b;

  const mid = new Uint8Array(bin.length);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let acc = seed;
      for (let dx = -radius; dx <= radius; dx++) {
        const sx = x + dx;
        if (sx < 0 || sx >= w) continue;
        acc = pick(acc, bin[row + sx]);
      }
      mid[row + x] = acc;
    }
  }

  const out = new Uint8Array(bin.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = seed;
      for (let dy = -radius; dy <= radius; dy++) {
        const sy = y + dy;
        if (sy < 0 || sy >= h) continue;
        acc = pick(acc, mid[sy * w + x]);
      }
      out[y * w + x] = acc;
    }
  }
  return out;
}

export function erode(bin: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  return morph(bin, w, h, radius, false);
}

export function dilate(bin: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  return morph(bin, w, h, radius, true);
}

/** Removes specks smaller than the structuring element. */
export function open(bin: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  return dilate(erode(bin, w, h, radius), w, h, radius);
}

/** Fills pinholes and closes hairline gaps. */
export function close(bin: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  return erode(dilate(bin, w, h, radius), w, h, radius);
}

/**
 * Keeps only the biggest 4-connected blob. Saliency models routinely fire on a
 * second object at the edge of the frame; without this the crop grows to
 * include it and the subject shrinks.
 */
export function largestComponent(bin: Uint8Array, w: number, h: number): Uint8Array {
  const labels = new Int32Array(bin.length).fill(-1);
  // Every pixel is labelled at the moment it is pushed, so it enters the stack once.
  const stack = new Int32Array(bin.length);
  let best = -1;
  let bestSize = 0;
  let label = 0;

  for (let start = 0; start < bin.length; start++) {
    if (bin[start] === 0 || labels[start] !== -1) continue;
    let top = 0;
    let size = 0;
    stack[top++] = start;
    labels[start] = label;

    while (top > 0) {
      const p = stack[--top];
      size++;
      const x = p % w;
      const y = (p / w) | 0;
      if (x > 0 && bin[p - 1] === 1 && labels[p - 1] === -1) {
        labels[p - 1] = label;
        stack[top++] = p - 1;
      }
      if (x < w - 1 && bin[p + 1] === 1 && labels[p + 1] === -1) {
        labels[p + 1] = label;
        stack[top++] = p + 1;
      }
      if (y > 0 && bin[p - w] === 1 && labels[p - w] === -1) {
        labels[p - w] = label;
        stack[top++] = p - w;
      }
      if (y < h - 1 && bin[p + w] === 1 && labels[p + w] === -1) {
        labels[p + w] = label;
        stack[top++] = p + w;
      }
    }

    if (size > bestSize) {
      bestSize = size;
      best = label;
    }
    label++;
  }

  const out = new Uint8Array(bin.length);
  if (best < 0) return out;
  for (let i = 0; i < bin.length; i++) out[i] = labels[i] === best ? 1 : 0;
  return out;
}

export function boundingBox(bin: Uint8Array, w: number, h: number): Box | null {
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (bin[y * w + x] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Grows a box by `fraction` of its longer side, clipped to the image. */
export function padBox(box: Box, w: number, h: number, fraction: number): Box {
  const pad = Math.round(Math.max(box.width, box.height) * fraction);
  const x0 = Math.max(0, box.x - pad);
  const y0 = Math.max(0, box.y - pad);
  const x1 = Math.min(w, box.x + box.width + pad);
  const y1 = Math.min(h, box.y + box.height + pad);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}
