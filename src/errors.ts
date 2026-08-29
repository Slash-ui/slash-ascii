/**
 * Errors that carry the process exit code they should produce. The CLI catches
 * CliError, prints the message to stderr, and exits with `exitCode`. Anything
 * else is a bug and gets a stack trace.
 */
export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.name = new.target.name;
    this.exitCode = exitCode;
  }
}

/** Bad arguments, or an input file that cannot be read. */
export class InputError extends CliError {
  constructor(message: string) {
    super(message, 1);
  }
}

/** The bytes were readable but are not an image we can decode. */
export class DecodeError extends CliError {
  constructor(message: string) {
    super(message, 2);
  }
}

/** Segmentation was requested but no model is available and none can be fetched. */
export class ModelUnavailableError extends CliError {
  constructor(message: string) {
    super(message, 3);
  }
}

/** The transfer failed or was truncated. */
export class DownloadError extends CliError {
  constructor(message: string) {
    super(message, 4);
  }
}

/** Size or checksum did not match the pinned values. */
export class IntegrityError extends CliError {
  constructor(message: string) {
    super(message, 5);
  }
}
