import { cosmiconfig } from 'cosmiconfig';
import type { Charset } from './pipeline/charmap.js';
import type { Format } from './options.js';
import type { ModelId } from './models/registry.js';

export type ColorSetting = 'auto' | 'true' | '256' | 'mono';

/** Everything a config file may set. Flags take precedence over all of it. */
export interface FileConfig {
  width?: number;
  height?: number;
  charAspect?: number;
  charset?: Charset;
  ramp?: string;
  invert?: boolean;
  color?: ColorSetting;
  format?: Format;
  denoise?: boolean;
  edges?: boolean;
  lineArt?: boolean;
  alphaCutoff?: number;
  threshold?: number;
  removeBg?: boolean;
  model?: ModelId;
  modelDir?: string;
  offline?: boolean;
  /**
   * Model ids the user has already agreed to download, so the prompt is not
   * repeated on every machine that shares this config.
   */
  consentedModels?: ModelId[];
}

const MODULE = 'slash-ascii';

export async function loadConfig(searchFrom?: string): Promise<FileConfig> {
  const explorer = cosmiconfig(MODULE, {
    packageProp: 'slashAscii',
    searchPlaces: [
      'package.json',
      `.${MODULE}rc`,
      `.${MODULE}rc.json`,
      `.${MODULE}rc.yaml`,
      `.${MODULE}rc.yml`,
      `${MODULE}.config.json`,
      `${MODULE}.config.js`,
      `${MODULE}.config.mjs`,
      `${MODULE}.config.cjs`,
    ],
  });
  const found = await explorer.search(searchFrom);
  return (found?.config as FileConfig | undefined) ?? {};
}
