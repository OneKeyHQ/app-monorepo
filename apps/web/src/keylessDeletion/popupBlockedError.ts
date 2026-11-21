export class PopupBlockedError extends Error {
  constructor() {
    super('Unable to open OAuth popup.');
  }
}
