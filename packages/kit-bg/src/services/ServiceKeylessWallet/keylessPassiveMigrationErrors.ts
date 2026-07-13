// Thrown when a passive-migration network request fails in a way that should
// NOT consume the 24h throttle window — e.g., the device is offline or the
// auth server is unreachable. The migration entrypoint catches this, rolls
// back the throttle write, and lets the next natural trigger (app launch /
// password cache) try again without delay.
export class KeylessPassiveMigrationNetworkError extends Error {
  constructor(cause?: unknown) {
    super('Keyless passive migration network error');
    this.name = 'KeylessPassiveMigrationNetworkError';
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}
