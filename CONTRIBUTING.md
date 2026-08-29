# Contributing

Bug reports and patches are welcome. If you are planning something large, open
an issue first so we can agree on the shape before you spend an evening on it.

## Getting set up

```
npm install
npm test
npm run build
git config core.hooksPath .githooks
```

That last line is worth running once. Hooks are not installed by cloning, and
the commit-msg hook is what tells you a message is malformed before ci does.

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

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/),
because the release is derived from them:

```
type(optional scope): description

Why, in the present tense. The diff already says what.
```

The type decides the version bump:

| Type                                    | Bump                   |
| --------------------------------------- | ---------------------- |
| `feat`                                  | minor, `0.1.0 → 0.2.0` |
| `fix`, `perf`                           | patch, `0.1.0 → 0.1.1` |
| `refactor`, `docs`                      | none, but listed       |
| `build`, `chore`, `ci`, `style`, `test` | none, not listed       |

A `!` after the type, or a `BREAKING CHANGE:` footer, marks a breaking change.
While the version is below 1.0.0 that bumps the minor rather than the major.

Scopes are optional and lowercase. `cli`, `render`, `segment`, `models` and
`pipeline` are the ones in use. Keep the subject under 72 characters, in
lowercase, with no full stop; write the reasoning in the body.

`scripts/check-commit-msg.sh` enforces this. The commit-msg hook and ci both
run it, so they cannot disagree about what is acceptable.

Pull requests do not need a template. Say what changed and what you checked. If
it touches character selection or the mask pipeline, a before-and-after render
of the same image is worth more than a paragraph. Give the pull request a title
in the same format as a commit subject: a squash merge takes its subject from
the title.

Tests are expected for behaviour changes. Snapshots are fine for rendering
output; assert on behaviour rather than on mocks everywhere else.

## Releases

Nobody edits the version by hand, and nobody writes a changelog entry by hand.
Both are derived, and the pipeline is:

1. A push to `main` runs release-please, which reads the commits since the last
   release and opens a pull request titled `chore(main): release x.y.z`. It
   carries the bumped `package.json` version and the new `CHANGELOG.md` section.
2. That pull request accumulates further changes to `main` until someone merges
   it. **Merging it is the approval to release.** Until then nothing is tagged
   and nothing is published.
3. The merge tags `vx.y.z` and creates the github release from the changelog.
4. That same run publishes to npm with provenance. A stable version is
   published under `latest`; a prerelease goes out under `next`, so
   `npm install slash-ascii` keeps meaning the stable release.

So the way to get an entry into the changelog is to write the commit that earns
it, and the way to control the version is to pick the right type. There is no
approval step after the merge: a gate there would leave a tag and a github
release for a version npm never received.

Two things the repo needs configured to run this end to end: an `NPM_TOKEN`
secret on the `npm` environment with publish rights, and, if `main` requires
status checks, a personal access token for release-please, since pull requests
opened with the default token do not start ci runs.

`NPM_TOKEN` can be retired once the package exists on npm: register this
repository and `release.yml` as a trusted publisher on npmjs.com and the
`id-token: write` permission the workflow already holds is enough to
authenticate, with no long-lived token in the repository at all.
