# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

Everything after 0.1.0 is written by release-please from the conventional
commit messages on `main`, so the way to add an entry here is to write the
commit that earns it. There is no unreleased section: the pending changes are
whatever the open release pull request is proposing.

## [0.3.0](https://github.com/Slash-ui/slash-ascii/compare/v0.2.0...v0.3.0) (2026-08-30)


### ⚠ BREAKING CHANGES

* resolveOptions, LINE_ART_PRESET, ALPHA_CUTOFF and LINE_ART_ALPHA_CUTOFF are no longer exported from the package entry point; import them from the source paths if you need them. ConvertOptions no longer carries lineArt, which now lives on ConvertInput, so CONVERT_DEFAULTS.lineArt is gone. resolveOptions also takes a defaults object rather than a boolean as its second argument. convert(input, { lineArt: true }) is unchanged.

### Fixed

* **pipeline:** render a vector for both axes of the grid ([f157e32](https://github.com/Slash-ui/slash-ascii/commit/f157e3255fa3d99f99f42f9b4c5688a521d84de8))


### Changed

* settle the vector decision inside decode ([721a629](https://github.com/Slash-ui/slash-ascii/commit/721a629e3d3c42a0abafbaa0d0fb5921141c90f5))


### Documentation

* rewrite the readme for a first-time reader ([511a959](https://github.com/Slash-ui/slash-ascii/commit/511a959ba638f92d196047f473ff9dc21d3e648d))
* show one photograph drawn all three ways ([b76f59c](https://github.com/Slash-ui/slash-ascii/commit/b76f59c90c12105bb14176d3a87d36ed689b759a))

## [0.2.0](https://github.com/Slash-ui/slash-ascii/compare/v0.1.2...v0.2.0) (2026-08-30)


### Added

* **pipeline:** add a line-art preset for hairline artwork ([8a9833b](https://github.com/Slash-ui/slash-ascii/commit/8a9833be5b3b0ad230d3697c39d5244f5cc69e95))


### Fixed

* **pipeline:** render a vector at the size the grid samples ([1fade7a](https://github.com/Slash-ui/slash-ascii/commit/1fade7a36ac382210feef89a946510c68711c111))

## [0.1.2](https://github.com/Slash-ui/slash-ascii/compare/v0.1.1...v0.1.2) (2026-08-29)


### Fixed

* point the package metadata at the repository it is built from ([838ba87](https://github.com/Slash-ui/slash-ascii/commit/838ba8729f870816775690a3c57b1bdf8911e1f8))

## [0.1.1](https://github.com/Slash-ui/slash-ascii/compare/v0.1.0...v0.1.1) (2026-08-29)


### Documentation

* describe the commit convention and the release flow ([93a2c47](https://github.com/Slash-ui/slash-ascii/commit/93a2c4739de93f7653b1d983ee6b1eef40b7272a))

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

[0.1.0]: https://github.com/Slash-ui/slash-ascii/releases/tag/v0.1.0
