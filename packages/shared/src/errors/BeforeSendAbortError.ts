/** A pre-send check that can safely return its owning flow to review. */
export class BeforeSendAbortError extends Error {
  readonly onAbort: () => boolean;

  constructor(message: string, onAbort: () => boolean) {
    super(message);
    this.name = 'BeforeSendAbortError';
    this.onAbort = onAbort;
  }
}
