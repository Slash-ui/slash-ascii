import type { Frame } from '../pipeline/charmap.js';
import { escapeMarkup, hex, rowRuns } from './runs.js';

const BACKGROUND = '#0b0b0b';
const FOREGROUND = '#d4d4d4';
const FONT_SIZE_PX = 12;

export function renderHtml(frame: Frame): string {
  const body: string[] = [];
  for (let y = 0; y < frame.rows; y++) {
    const line = rowRuns(frame, y)
      .map((run) => {
        const style = [
          run.fg ? `color:${hex(run.fg)}` : '',
          run.bg ? `background:${hex(run.bg)}` : '',
        ]
          .filter(Boolean)
          .join(';');
        const text = escapeMarkup(run.text);
        return style && !run.blank ? `<span style="${style}">${text}</span>` : text;
      })
      .join('');
    body.push(line);
  }

  // 1ch is the advance width of a monospace cell, so deriving line-height from it
  // keeps the aspect correct whatever font the reader ends up with.
  const lineHeight = (1 / frame.charAspect).toFixed(4);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>slash-ascii</title>
<style>
  body { margin: 0; background: ${BACKGROUND}; }
  pre.ascii {
    margin: 0;
    padding: 1rem;
    color: ${FOREGROUND};
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
    font-size: ${FONT_SIZE_PX}px;
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
