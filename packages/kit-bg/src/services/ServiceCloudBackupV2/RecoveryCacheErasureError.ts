import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

export class RecoveryCacheErasureError extends OneKeyLocalError {
  constructor() {
    super('Recovery cache erasure failed');
  }
}
