export class FirmwareArtifactDesktopError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
    public readonly discardStaging: boolean,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'FirmwareArtifactDesktopError';
  }
}

export const firmwareArtifactDesktopError = (
  code: string,
  message: string,
  retryable = false,
  discardStaging = false,
  cause?: unknown,
): FirmwareArtifactDesktopError =>
  new FirmwareArtifactDesktopError(code, message, retryable, discardStaging, {
    cause,
  });

export const classifyFirmwareArtifactStorageFailure = (
  error: unknown,
  message: string,
): FirmwareArtifactDesktopError => {
  if (error instanceof FirmwareArtifactDesktopError) return error;
  return firmwareArtifactDesktopError(
    'ARTIFACT_STORAGE_FAILED',
    message,
    false,
    false,
    error,
  );
};
