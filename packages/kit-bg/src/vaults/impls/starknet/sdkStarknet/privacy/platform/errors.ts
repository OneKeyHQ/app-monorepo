// onekey: the repo forbids `throw new Error` (onekey/no-raw-error), and this
// package stays self-contained so it can be swapped for an upstream npm release
// later — it must not import @onekeyhq/shared. Shim-layer failures therefore get
// one named type. kit-bg should map it to a OneKeyLocalError at its boundary.

/** A runtime capability the vendored SDK needs is missing on this platform. */
export class StarknetPrivacySdkPlatformError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StarknetPrivacySdkPlatformError';
  }
}
