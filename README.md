# slash-ascii

Turns an image into ASCII art in your terminal. It can also strip the
background first, so you get the subject and nothing else.

```
npx slash-ascii photo.jpg
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

That is a photograph of a white tiger, rendered at 76 columns. Characters are
picked from a density ramp by brightness, except where the gradients inside a
cell agree on a direction, which gets a line character instead. That is what
makes the stripes and the outline read as edges rather than as a smear of ramp
steps.

With `--remove-bg` the foliage goes and the frame closes in on what is left:

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

## Install

There is nothing to install if you only want to run it:

```
npx slash-ascii photo.jpg
```

Otherwise:

```
npm install -g slash-ascii
```

Node 20 or newer. No model weights are bundled, and nothing is downloaded when
you install. See [Offline and model policy](#offline-and-model-policy).

## Usage

```
slash-ascii <input> [options]
slash-ascii model <install|list|remove|info|path> [id]
```

`<input>` is a path to an image, or `-` to read one from stdin.

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

## Examples

Fit the image to the current terminal, in colour:

```
slash-ascii photo.jpg
```

A fixed width, no colour, into a file:

```
slash-ascii photo.jpg --width 100 --color mono --format txt -o photo.txt
```

Half blocks, which give each cell an independently coloured top and bottom and
so double the vertical resolution. Not ASCII any more, but it looks far better:

```
slash-ascii photo.jpg --charset blocks
```

Read from stdin, write an SVG you can drop into a page:

```
curl -s https://example.com/photo.jpg | slash-ascii - --format svg -o photo.svg
```

Subject only, on a light terminal:

```
slash-ascii portrait.jpg --remove-bg --invert
```

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

## Vector sources

An SVG is rendered at whatever resolution the grid is about to sample, rather
than at its nominal size, so a 318 unit wide logo feeding a 128 column grid is
rasterised at 512 pixels instead of being rasterised at 318 and then enlarged.
Fine strokes stand or fall on that: enlarging a raster cannot put back detail
the rasteriser was never asked for.

Vectors also skip the median filter by default, having no sensor noise for it to
remove and a good deal of thin line for it to erode. Set `"denoise": true` in a
config file if you want it back.

## Character sets

`ascii` is the default: a brightness ramp, with `-`, `|`, `/` and `\` used
where a cell contains a clear edge.

`blocks` uses `▀` with separate foreground and background colours, so one cell
carries two pixels. This is the best-looking mode by some distance, and it is
not ASCII, which is why it is opt-in.

`braille` packs 2x4 dots into each cell using an ordered dither. Highest
resolution of the three, and the most dependent on your font having decent
braille coverage.

## Colour

By default colour is detected from the terminal: truecolor if it is advertised,
otherwise the 256-colour palette, otherwise none. Output that is not going to a
terminal gets no colour, so piping to a file or another program gives you clean
text without escape sequences. `--color` overrides all of that.

Every coloured line ends with a reset, so a truncated pipe cannot leave your
terminal painted.

## Background removal

`--remove-bg` runs a saliency model over the image, keeps the largest connected
region of the mask, and crops to it. Without the crop you tend to get a small
subject adrift in a frame of blanks.

```
slash-ascii portrait.jpg --remove-bg
slash-ascii portrait.jpg --remove-bg --model full --threshold 0.6
```

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

Settings can live in `slash-ascii.config.json`, `.slash-asciirc`, or a
`slashAscii` key in `package.json`. Flags beat the config file, which beats the
defaults.

```json
{
  "charset": "blocks",
  "charAspect": 0.45,
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

## Licence

MIT. See [LICENSE](LICENSE).

The model weights are Apache-2.0 and are not redistributed here: the tool
fetches them from their original host, at your request. Their licence is shown
in the consent prompt and in `slash-ascii model info`.
