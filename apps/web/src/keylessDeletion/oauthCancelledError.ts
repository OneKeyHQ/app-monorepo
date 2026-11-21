export class OAuthCancelledError extends Error {
  constructor() {
    super('OAuth sign-in was cancelled.');
  }
}
