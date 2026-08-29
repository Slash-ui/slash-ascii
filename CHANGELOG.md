# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

Everything after 0.1.0 is written by release-please from the conventional
commit messages on `main`, so the way to add an entry here is to write the
commit that earns it. There is no unreleased section: the pending changes are
whatever the open release pull request is proposing.

## [0.1.0]

First release.

### Added

- Convert an image to ASCII, sized to the terminal or to an explicit width or
  height, with `--char-aspect` to correct for cell shape.
- Edge-aware character selection. Cells whose gradients agree on a direction get
  a line character; the cutoff comes from the image's own gradient distribution
  rather than a fixed threshold, so the same defaults suit a line drawing and a
  photograph.
- `ascii`, `blocks` and `braille` character sets, `--invert`, and a `--ramp`
  override.
- Truecolor, 256-colour and monochrome output, detected from the terminal by
  default and disabled when output is not a terminal.
- `ansi`, `txt`, `html` and `svg` output formats.
- Optional background removal with `--remove-bg`, using U^2-Net through
  onnxruntime. Models are not bundled and are downloaded only after an explicit
  yes, verified against a pinned size and SHA-256.
- `slash-ascii model install|list|remove|info|path`, including
  `--from` for installing a model from local disk on a machine with no network
  access.
- Configuration via `slash-ascii.config.json`, `.slash-asciirc` or a
  `slashAscii` key in `package.json`.

[0.1.0]: https://github.com/slashui/slash-ascii/releases/tag/v0.1.0
