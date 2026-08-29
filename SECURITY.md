# Security

## Reporting

Report vulnerabilities privately, not as a public issue.

- GitHub: use the Report a vulnerability button under the Security tab
- Email: amin@slashui.com

You should get an acknowledgement within five working days. If a fix is needed,
you will get an estimate at that point, and credit in the release notes unless
you would rather not be named.

## What is worth reporting

The security-relevant surface of this tool is small but real:

- Anything that lets a model file be loaded without matching its pinned size and
  SHA-256, or that lets a partially written file be treated as verified
- Anything that causes a network request on the default path, on install, or
  without consent
- Path traversal or arbitrary writes via `--output`, `--model-dir` or
  `--from`
- Crashes on malformed image input that go beyond a clean decode failure

Denial of service from a deliberately enormous image is out of scope. The tool
decodes what you point it at.

## Dependencies

Image decoding is handled by sharp, which wraps libvips, and inference by
onnxruntime. Vulnerabilities in those belong upstream, but tell us anyway so the
floor can be raised here.
