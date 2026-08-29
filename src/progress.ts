export interface Bar {
  update(received: number, total: number | null): void;
  done(): void;
}

/** A bar only makes sense on a terminal; anywhere else it becomes line noise. */
export function progressBar(label: string, stream: NodeJS.WriteStream): Bar | null {
  if (!stream.isTTY) return null;
  let last = 0;

  return {
    update(received, total) {
      const now = Date.now();
      if (now - last < 80 && received !== total) return;
      last = now;
      const width = Math.max(10, Math.min(40, (stream.columns ?? 80) - label.length - 24));
      // Fixed unit rather than formatBytes: the bar should not jitter sideways as
      // the transfer crosses from kB into MB.
      const megabytes = (received / 1e6).toFixed(1);
      if (total) {
        const ratio = Math.min(1, received / total);
        const filled = Math.round(ratio * width);
        const bar = '='.repeat(filled) + ' '.repeat(width - filled);
        stream.write(
          `\r${label} [${bar}] ${(ratio * 100).toFixed(0).padStart(3)}%  ${megabytes} MB`,
        );
      } else {
        stream.write(`\r${label} ${megabytes} MB`);
      }
    },
    done() {
      stream.write('\n');
    },
  };
}
