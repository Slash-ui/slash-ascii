import type { Sharp } from 'sharp';

/**
 * Sensor noise costs twice: it speckles the segmentation matte, and it makes
 * neighbouring cells pick different characters out of the ramp for what should
 * be flat tone. A 3x3 median removes it without softening edges the way a blur
 * would, which matters because edge direction drives character selection.
 */
export function denoise(img: Sharp): Sharp {
  return img.median(3);
}
