import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

export class PublicAccountSnapshotUnsupportedError extends OneKeyLocalError {
  constructor() {
    super('This account snapshot requires a compatible App version.');
  }
}
