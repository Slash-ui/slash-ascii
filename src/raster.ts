/** Interleaved RGBA, 8 bits per channel, row-major. */
export interface Raster {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface Size {
  width: number;
  height: number;
}
