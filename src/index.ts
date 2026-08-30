export { convert, SUB } from './pipeline/run.js';
export { CONVERT_DEFAULTS, LINE_ART_PRESET, resolveOptions } from './options.js';
export type { ConvertOptions, ConvertDeps, Format, MaskProvider } from './options.js';
export { ALPHA_CUTOFF, LINE_ART_ALPHA_CUTOFF, RAMPS } from './pipeline/charmap.js';
export type { Charset, Frame, RenderCell, RGB } from './pipeline/charmap.js';
export type { Raster, Size } from './raster.js';
export { readInput } from './pipeline/decode.js';
export type { ColorMode } from './render/ansi.js';
export { loadConfig } from './config.js';
export type { FileConfig, ColorSetting } from './config.js';
export {
  CliError,
  DecodeError,
  DownloadError,
  InputError,
  IntegrityError,
  ModelUnavailableError,
} from './errors.js';
