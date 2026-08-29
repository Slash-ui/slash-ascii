import type { Frame } from '../pipeline/charmap.js';
import { renderAnsi } from './ansi.js';

/**
 * Plain text is the monochrome ANSI path: same characters, same trailing-blank
 * handling, no escape sequences. Kept as its own name so the format list and the
 * renderer list stay one-to-one.
 */
export function renderText(frame: Frame): string {
  return renderAnsi(frame, 'mono');
}
