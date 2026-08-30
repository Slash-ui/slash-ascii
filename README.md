<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Slash-ui/slash-ascii/main/docs/logo-dark.png">
  <img alt="Slash UI" src="https://raw.githubusercontent.com/Slash-ui/slash-ascii/main/docs/logo-light.png" width="300">
</picture>

# slash-ascii

**Turn any image into text art, right in your terminal.**

Photos, logos, screenshots, SVGs. One command, no setup, nothing to configure.

[![npm](https://img.shields.io/npm/v/slash-ascii?color=5F53EF)](https://www.npmjs.com/package/slash-ascii)
[![licence](https://img.shields.io/npm/l/slash-ascii?color=5F53EF)](LICENSE)
[![node](https://img.shields.io/node/v/slash-ascii?color=5F53EF)](https://nodejs.org)

</div>

<br>

<img alt="The Slash UI logo rendered as coloured half-block characters in a terminal" src="https://raw.githubusercontent.com/Slash-ui/slash-ascii/main/docs/example-blocks.png">

<div align="center"><sub>The Slash UI logo, drawn with <code>--charset blocks --line-art -w 124</code></sub></div>

<br>

## Try it in one line

If you have [Node.js](https://nodejs.org) 20 or newer, you already have everything you need:

```
npx slash-ascii your-image.png
```

That's it. No install, no account, no config file. It prints your image to the
screen as text and exits.

<details>
<summary><b>Never used a terminal before? Start here.</b></summary>

<br>

A terminal is a window where you type commands instead of clicking buttons.
Every computer has one built in.

**1. Open it**

| Your computer | How to open the terminal |
| --- | --- |
| **Mac** | Press `Cmd` + `Space`, type `Terminal`, press Enter |
| **Windows** | Press the Start button, type `Terminal`, press Enter |
| **Linux** | Press `Ctrl` + `Alt` + `T` |

**2. Check you have Node.js**

Type this and press Enter:

```
node --version
```

If you see a number like `v20.11.0` or higher, you're ready. If you see
"command not found", install Node.js from [nodejs.org](https://nodejs.org)
(pick the button labelled **LTS**), then close and reopen the terminal.

**3. Run it on your own picture**

Type `npx slash-ascii ` — including the space at the end — then **drag your
image file from Finder or File Explorer straight onto the terminal window**.
The file's location gets typed out for you. Press Enter.

That drag-and-drop trick saves you ever having to work out what a "path" is.

</details>

## Install it properly

Running with `npx` fetches the tool each time. If you'll use it more than once,
install it so you can just type `slash-ascii`:

```
npm install -g slash-ascii
```

Then:

```
slash-ascii your-image.png
```

Requires Node.js 20 or newer. **Installing makes no network requests and runs no
install scripts.** Nothing is downloaded unless you explicitly ask for
[background removal](#remove-the-background) later.

## Three ways to draw

The `--charset` option decides which characters get used. Here is one
photograph drawn all three ways, at 32 columns wide, with the background
removed:

<div align="center">
  <img alt="The original photograph: a 3D-rendered astronaut holding a notepad, against a blurred purple background" src="https://raw.githubusercontent.com/Slash-ui/slash-ascii/main/docs/astro-original.png" width="240">
  <br>
  <sub><b>The original</b> — <code>astro.png</code></sub>
</div>

<br>

<img alt="The astronaut drawn with ASCII characters in a terminal" src="https://raw.githubusercontent.com/Slash-ui/slash-ascii/main/docs/astro-ascii.png">

<div align="center"><sub><code>--charset ascii --line-art -w 32 --remove-bg</code></sub></div>

<br>

<img alt="The astronaut drawn with coloured half-block characters in a terminal" src="https://raw.githubusercontent.com/Slash-ui/slash-ascii/main/docs/astro-blocks.png">

<div align="center"><sub><code>--charset blocks --line-art -w 32 --remove-bg</code></sub></div>

<br>

<img alt="The astronaut drawn with braille dot characters in a terminal" src="https://raw.githubusercontent.com/Slash-ui/slash-ascii/main/docs/astro-braille.png">

<div align="center"><sub><code>--charset braille --line-art -w 32 --remove-bg</code></sub></div>

<br>

Same image, same width, three very different results. Only `--charset` changes
between them — [`--remove-bg`](#remove-the-background) is the optional extra
that dropped the studio background, and you don't need it to try a charset.

Each is better at a different thing.

### `ascii` — the default

Classic text art, using only characters you'd find on a keyboard. Safe to paste
anywhere: a code comment, a commit message, a chat window, a plain text file.

```
slash-ascii tiger.jpg
```

```
............................................................................
....::.......................:..:...........................................
::.::....:...................:...........:..................................
.............................:...........:..................................
.:...........................-..............................................
.............................:..............................................
.........:...................:..........................................:...
.............::.....--..------...-..........................................
..:...::......::....\-+-#*++=+*-+-=.........:...............................
.:.............:...../|*+-+*++\+*|..........::::.........:.............:....
...................../|==-/##-+==|......::..:::...........:\-:........::..::
....................|==--|#--*|--|\.....::..........:.......::.:............
....:.............../\--=-+---+--*#-\-:---.........::....::::...............
.................../=\=-::---::-=*#%|%|%%%*-+--------------.:..::........::.
..............:....|\==\--:..://-%%#*%%%%%/#//%/-//*#***-*-=\--.....:.......
.................-/**\=++--=---#%%//|%%%#/-///-*/******--+-//**--:..........
::.......::::----/*=---=///*###%#/##*#/-///#-#%%*+++**-*++++-|#/|+--........
::::::-------#--==|*\::---/#%%%##%%%#/////#%%##*+=/---#**\=|=*/-/=-*=.......
:::::=-*###-/-.\=-:----%%%%%%%%%%###///*/#%#**##-+//-#*-+-/-:-::-:/+=-::....
::::::-----::/-----###-#/\----------/-=-=--++/-**+-=##*--\......:-:::..:....
:::---------:---/:\-----:-------::-=-/:.:::-=-==-----\---/--::-::...........
::.::::::::::-:-:::::-::::::::--:::--:::::::---:.....:::::.::..::::::.......
..:::................:.::..::::::::.:::-::::::::::::::::::::::..............
....::............:-:..................-=-:.:-\.........:.:.................
...................:---:...............-::--:::.........::..................
```

A photograph of a white tiger at 76 columns. Brightness picks a character from
a density ramp — except where a cell contains a clear edge, which gets a line
character (`-`, `|`, `/`, `\`) instead. That is what makes the stripes read as
stripes rather than a smear of ramp steps.

### `blocks` — the best-looking one

```
slash-ascii your-image.png --charset blocks
```

Uses the half-block character `▀` with a separate colour above and below, so
every character carries two pixels. It is not really ASCII any more, which is
why you have to ask for it — but it looks dramatically better. This is what the
image at the top of this page uses.

### `braille` — the most detailed

```
slash-ascii your-image.png --charset braille
```

Packs 2×4 dots into every character, so it resolves far more detail than the
other two. Best for line drawings and fine structure.

Your terminal font needs braille characters for this to look right. Most modern
ones have them; if you see empty boxes, use `blocks` instead.

## Common things you might want

**Make it bigger or smaller.** Width is measured in characters across:

```
slash-ascii photo.jpg -w 60      # small
slash-ascii photo.jpg -w 200     # large
```

With no `-w`, it fills your terminal window.

**Save it to a file** instead of printing it:

```
slash-ascii photo.jpg --format txt -o art.txt
```

**Keep the colours** when saving, as a web page or an image:

```
slash-ascii photo.jpg --format html -o art.html
slash-ascii photo.jpg --format svg  -o art.svg
```

**Convert a logo or drawing** with thin lines — see [Thin lines and
logos](#thin-lines-and-logos):

```
slash-ascii logo.svg --charset blocks --line-art -w 124
```

**Remove the background** and keep only the subject:

```
slash-ascii portrait.jpg --remove-bg
```

**Use it on a light-coloured terminal.** Flip the ramp so dark and light aren't
inverted:

```
slash-ascii photo.jpg --invert
```

**Convert an image from the internet** without saving it first:

```
curl -s https://example.com/photo.jpg | slash-ascii - --format svg -o art.svg
```

## Something look wrong?

| What you're seeing | Try this |
| --- | --- |
| `command not found: npx` | Install [Node.js](https://nodejs.org), then reopen your terminal |
| Output is stretched or squashed | `--char-aspect 0.45` (see [Sizing](#sizing)) |
| Too big, or wrapping messily | Set a width: `-w 80` |
| Everything looks washed out on a light background | `--invert` |
| No colour at all | `--color true` forces it on |
| Empty boxes instead of braille dots | Your font lacks braille; use `--charset blocks` |
| Thin lines in a logo are missing or speckled | `--line-art` |
| Colour codes appear as `[38;2;...` gibberish in a file | Use `--format txt`, or `--color mono` |

## Full options

```
slash-ascii <input> [options]
slash-ascii model <install|list|remove|info|path> [id]
```

`<input>` is a path to an image, or `-` to read one from standard input.

| Flag | Default | What it does |
| --- | --- | --- |
| `-w, --width <n>` | terminal width | Output width in columns |
| `-h, --height <n>` | derived from the image | Output height in rows |
| `--char-aspect <n>` | `0.5` | Cell width divided by cell height |
| `-c, --color <mode>` | auto | `true`, `256`, `mono` |
| `--charset <name>` | `ascii` | `ascii`, `blocks`, `braille` |
| `--ramp <chars>` | `" .:-=+*#%@"` | Ramp characters, darkest first |
| `--invert` | off | Flip the ramp, for light backgrounds |
| `--no-edges` | edges on | Use brightness alone, no line characters |
| `--no-denoise` | on for bitmaps | Skip the median filter |
| `--line-art` | off | Keep hairlines: no median filter, lower coverage cutoff |
| `--alpha-cutoff <n>` | `0.5` | Coverage a cell needs before it paints, 0 to 1 |
| `--remove-bg` | off | Keep only the subject. Needs a model |
| `--model <tier>` | `lite` | `lite` or `full` |
| `--threshold <n>` | `0.5` | Mask cutoff, 0 to 1 |
| `--format <fmt>` | `ansi` | `ansi`, `txt`, `html`, `svg` |
| `-o, --output <file>` | stdout | Write to a file |
| `--offline` | off | Fail rather than fetch anything |
| `-y, --yes` | off | Approve model downloads without asking |
| `--model-dir <path>` | cache directory | Where models are stored |

`-h` is the height flag, so help is `--help` only. That is deliberate: sizing is
the thing you reach for constantly, and `--help` is the thing you reach for
twice.

## Sizing

With no `--width` or `--height`, the output is fitted to the terminal width, or
80 columns when that cannot be read (a pipe, for instance).

Row count is derived from the image aspect and `--char-aspect`, which is the
width of a character cell divided by its height. The default of `0.5` assumes
cells are twice as tall as they are wide, which is close enough for most
terminal fonts. If your output looks stretched or squashed, this is the knob:

```
slash-ascii photo.jpg --char-aspect 0.45
```

## Thin lines and logos

A stroke narrower than a character cell is a coverage problem, not a resolution
problem. A cell paints only once it is at least half covered, so a hairline
crossing a cell covers perhaps a fifth of it, falls short, and the line arrives
as speckle or not at all. Logos with hairline rules, dashed outlines, technical
drawings and wireframes all land here.

`--line-art` is the answer to that: it lowers the coverage cutoff to `0.15` and
turns off the median filter, which is a majority vote among neighbours that any
stroke thinner than its 3x3 window loses.

```
slash-ascii logo.svg --charset blocks --line-art -w 124
```

That is the command behind the image at the top of this page. Without
`--line-art`, the dashed outlines in the Slash UI mark break up into scattered
dots. The same mark in braille, which resolves the dashes more finely still:

<img alt="The Slash UI logo rendered as braille dot characters in a terminal" src="https://raw.githubusercontent.com/Slash-ui/slash-ascii/main/docs/example-braille.png">

<div align="center"><sub><code>--charset braille --line-art -w 124</code></sub></div>

<br>

It only ever adds ink, never removes it. The cost is that a cutoff low enough to
catch a stroke also catches the antialiased rim of a solid shape, so silhouettes
grow by up to a cell. Reach for it when the thin parts matter more than the
edges are crisp, and tune it with `--alpha-cutoff` if the preset's `0.15`
overshoots or undershoots — the flag wins over the preset.

There is still a floor. A feature narrower than one cell can be *detected* but
not *drawn* at its true width, so the width you need is roughly:

```
columns >= image width in pixels / width of the thinnest stroke in pixels
```

A 2px rule on a 318px-wide logo wants about 160 columns before it occupies a
full cell of its own. Below that, `--line-art` keeps the line visible but
thickens it. If you control the source, the more reliable fix is a separate
master drawn for the medium, with strokes two or three times their screen
weight — the same reasoning that gives a favicon its own artwork.

### Vector sources

An SVG is rendered at whatever resolution the grid is about to sample, rather
than at its nominal size, so a 318 unit wide logo feeding a 128 column grid is
rasterised at 512 pixels instead of being rasterised at 318 and then enlarged.
Fine strokes stand or fall on that: enlarging a raster cannot put back detail
the rasteriser was never asked for.

Vectors also skip the median filter by default, having no sensor noise for it to
remove and a good deal of thin line for it to erode. Set `"denoise": true` in a
config file if you want it back.

## Colour

By default colour is detected from the terminal: truecolor if it is advertised,
otherwise the 256-colour palette, otherwise none. Output that is not going to a
terminal gets no colour, so piping to a file or another program gives you clean
text without escape sequences. `--color` overrides all of that.

Every coloured line ends with a reset, so a truncated pipe cannot leave your
terminal painted.

## Remove the background

`--remove-bg` runs a saliency model over the image, keeps the largest connected
region of the mask, and crops to it. Without the crop you tend to get a small
subject adrift in a frame of blanks.

```
slash-ascii portrait.jpg --remove-bg
slash-ascii portrait.jpg --remove-bg --model full --threshold 0.6
```

Every screenshot in [Three ways to draw](#three-ways-to-draw) uses it: the
astronaut's purple studio background is gone in all three, and the frame has
closed in on the figure.

Here it is on the tiger, with the foliage gone and the frame closed in on what
is left:

```

                   ==- #**++*+   ++
                    =#+%-**-++#*+-
                    |+*=-+**+==+++
                   ||==+#*#%#*++||
                   +=--=##*+*#=-|*+
                   |---=+*-:-*=:-*#*+-
                  -*+=-:.----:--=##%%|%*%#%*--+--
                  \==+--::::..:-+#%%/###%%%#%//+%#*/*#*%*------
                 *#|++=+=::--=*#%%%*/#%%%%##%/=##+=%*+##*+=--=-/-+-
                #\+=+=*-=+++#%*#%#+#+##%%///////=##***-+*----+#*--+#|
           --##++=:----=*/**#-%%--#%|##///-/##*%%%++=+**--*--+=-.+#*|++-
       %%%%#+=-=+*=::-++-##%%%%*%%%%##//*//#%%%##*+/----#**+#+|*|#/-+==-#
  #######+= :=-::++--#%%%%%%%%%%%####*/*#**%%#*##*+=+------\==-=:-::---*+=
  ++------  -----%%####*+##*#####+**/-=*+-***++###**--*#-+*-=........:--:-
           **#/ +*---=-----:         /-:.-=--++--+#----*###**-:.::--=:=
                                     =.:...::-  -:-:....=----
```

This is the one feature that needs a model file, and it is **not** bundled. The
first time you use it, the tool explains exactly what it wants to download and
asks permission. See [Offline and model policy](#offline-and-model-policy).

Two model tiers are available:

| Tier | Model | Size | Good for |
| --- | --- | --- | --- |
| `lite` (default) | u2netp | 4.6 MB | General subjects, fast |
| `full` | u2net | 176.0 MB | Fine edges, hair, complex outlines |

Both are U^2-Net under Apache-2.0.

Inference runs on the WASM build of onnxruntime, which needs no compiler and no
native binaries. If you want the faster path, install `onnxruntime-node`
yourself and it will be picked up automatically:

```
npm install onnxruntime-node
```

## Offline and model policy

This is the unusual part of the tool, so it is stated plainly.

1. Installing this package makes **no** network requests. There is no
   `postinstall` script.
2. Every feature except background removal works with the network unplugged.
3. Nothing is downloaded implicitly, in the background, or on a schedule.
4. The only thing that is ever fetched is a segmentation model, only when you
   pass `--remove-bg` or run `model install`, and only after you say yes.

When background removal needs a model that is not cached, the tool stops and
prints this to stderr, so it cannot contaminate output you are piping
somewhere:

```
Background removal needs a segmentation model. It is not bundled with
this tool and has not been downloaded yet.

  Model      u2netp (U^2-Net lite)
  Size       4.6 MB
  License    Apache-2.0
  Source     github.com/danielgatis/rembg  (releases)
  Saves to   ~/.cache/slash-ascii/models/u2netp.onnx

Why this is needed: separating a subject from its background requires a
trained saliency model. Every other feature of this tool runs without one.

This is a one-time download. It will be verified against a pinned
SHA-256 checksum before use.

To skip it, run again without --remove-bg and the whole image will be
converted as-is.

Download now? [y/N]
```

A bare Enter declines, and declining is not an error: the tool exits 0 and tells
you how to get output without a model. Downloads are verified against a pinned
size and SHA-256 before the file is moved into place, and the checksum is
re-checked on load.

The prompt is skipped when you pass `--yes`, set `SLASH_ASCII_ASSUME_YES=1`, or
list the model under `consentedModels` in a config file.

Without a terminal to ask — in CI, in a pipeline, under cron — the tool does not
hang and does not download. It prints the same details and exits 3 with the
command you would need to install the model deliberately. `--offline` and
`SLASH_ASCII_OFFLINE=1` do the same thing, and outrank every form of
pre-approval.

### Where models are stored

In order of precedence: `--model-dir`, then `SLASH_ASCII_MODEL_DIR`, then the
per-OS cache directory.

| OS | Path |
| --- | --- |
| Linux | `~/.cache/slash-ascii/models` |
| macOS | `~/Library/Caches/slash-ascii/models` |
| Windows | `%LOCALAPPDATA%\slash-ascii\Cache\models` |

### Air-gapped and manual installation

```
slash-ascii model path                                # print the cache directory
slash-ascii model info lite                           # url, size, sha-256, licence
slash-ascii model install lite                        # download, no prompt
slash-ascii model install lite --from ./u2netp.onnx   # copy from local disk
slash-ascii model list                                # what is installed
slash-ascii model remove full                         # delete a cached model
```

`--from` verifies the checksum too, so a file carried in on a USB stick gets the
same guarantee as a downloaded one. `model info` prints the URL and hash you
need to fetch it on another machine.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Success, including a declined download |
| 1 | Bad arguments, or an input that could not be read |
| 2 | The input is not an image we can decode |
| 3 | A model is needed but unavailable and cannot be fetched |
| 4 | A download failed |
| 5 | An integrity check failed |

## Configuration file

If you always pass the same flags, put them in a file instead. Settings can live
in `slash-ascii.config.json`, `.slash-asciirc`, or a `slashAscii` key in
`package.json`. Flags beat the config file, which beats the defaults.

```json
{
  "charset": "blocks",
  "charAspect": 0.45,
  "lineArt": true,
  "consentedModels": ["lite"]
}
```

## Use as a library

```js
import { convert } from 'slash-ascii';
import { readFile } from 'node:fs/promises';

const art = await convert(await readFile('photo.jpg'), {
  width: 80,
  format: 'txt',
});
```

`convert` takes an optional third argument for segmentation. It expects a
function returning a saliency map for a raster, which keeps the model handling,
the consent flow and the network out of the conversion path entirely.

## Development

```
npm install
npm test
npm run build
```

Tests never touch the network. The downloader is exercised against a local HTTP
server, and there is a test file whose whole job is to run the default paths
with `fetch` rigged to throw.

Fixtures are generated by `scripts/make-fixtures.mjs` and committed.

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for the
commit convention and how releases are cut.

## Licence

MIT. See [LICENSE](LICENSE).

The model weights are Apache-2.0 and are not redistributed here: the tool
fetches them from their original host, at your request. Their licence is shown
in the consent prompt and in `slash-ascii model info`.
