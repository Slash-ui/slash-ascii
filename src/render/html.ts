import type { Frame } from '../pipeline/charmap.js';
import { hex, isInvisible, rowRuns } from './runs.js';

export interface HtmlOptions {
  /** Cell width divided by cell height, matching the grid the frame was built for. */
  charAspect: number;
  background: string;
  foreground: string;
  title: string;
}

export const HTML_DEFAULTS: HtmlOptions = {
  charAspect: 0.5,
  background: '#0b0b0b',
  foreground: '#d4d4d4',
  title: 'slash-ascii',
};

export function renderHtml(frame: Frame, opts: HtmlOptions): string {
  const body: string[] = [];
  for (let y = 0; y < frame.rows; y++) {
    const line = rowRuns(frame, y)
      .map((run) => {
        if (isInvisible(run)) return escapeHtml(run.text);
        const style = [
          run.fg ? `color:${hex(run.fg)}` : '',
          run.bg ? `background:${hex(run.bg)}` : '',
        ]
          .filter(Boolean)
          .join(';');
        if (!style) return escapeHtml(run.text);
        return `<span style="${style}">${escapeHtml(run.text)}</span>`;
      })
      .join('');
    body.push(line);
  }

  // 1ch is the advance width of a monospace cell, so deriving line-height from it
  // keeps the aspect correct whatever font the reader ends up with.
  const lineHeight = (1 / opts.charAspect).toFixed(4);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(opts.title)}</title>
<style>
  body { margin: 0; background: ${opts.background}; }
  pre.ascii {
    margin: 0;
    padding: 1rem;
    color: ${opts.foreground};
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
    font-size: 12px;
    line-height: ${lineHeight}ch;
    white-space: pre;
    overflow-x: auto;
  }
</style>
</head>
<body>
<pre class="ascii">${body.join('\n')}</pre>
</body>
</html>
`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
