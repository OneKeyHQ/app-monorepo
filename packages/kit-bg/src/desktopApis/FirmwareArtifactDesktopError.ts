import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

export class FirmwareArtifactDesktopError extends OneKeyLocalError {
  constructor(code: string, message: string, options?: ErrorOptions) {
    super(`${code}: ${message}`);
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}
