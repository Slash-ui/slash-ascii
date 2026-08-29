# Contributing

Bug reports and patches are welcome. If you are planning something large, open
an issue first so we can agree on the shape before you spend an evening on it.

## Getting set up

```
npm install
npm test
npm run build
```

`npm install` pulls sharp and onnxruntime-web. Neither needs a compiler; both
ship prebuilt binaries. There is no separate model download step, and there
should never be one.

Useful commands:

- `npm test` runs the suite once, `npm run test:watch` keeps it going
- `npm run typecheck` runs tsc without emitting
- `npm run build` produces `dist/`
- `node scripts/make-fixtures.mjs` regenerates the test images, which are
  committed so the suite does not depend on regenerating them

## The rule that matters

The default path makes no network requests, and neither do the tests. If a
change makes `npm install` or a plain `slash-ascii photo.png` reach the network,
that is a bug regardless of how convenient it is.

`test/offline.test.ts` exists to catch this: it runs the default paths with
`fetch` rigged to throw. The downloader tests serve a small stand-in file from a
local HTTP server rather than fetching anything real. Please keep both true.

## Pinning a model

Model artifacts are pinned by exact byte length and SHA-256 in
`src/models/registry.ts`. If you add a tier:

1. Download the artifact and record `stat -f %z file` and `shasum -a 256 file`.
2. Check the licence. Anything that is not permissive does not belong here,
   because the restriction would land on everyone using the tool. RMBG-1.4 is
   deliberately absent for exactly this reason.
3. Add the entry with its licence and source, and check `slash-ascii model info`
   shows both.

## Commits and pull requests

Write commit messages that say why, not what. The diff already says what.
Present tense, no prefix convention to memorise.

Pull requests do not need a template. Say what changed and what you checked. If
it touches character selection or the mask pipeline, a before-and-after render
of the same image is worth more than a paragraph.

Tests are expected for behaviour changes. Snapshots are fine for rendering
output; assert on behaviour rather than on mocks everywhere else.
