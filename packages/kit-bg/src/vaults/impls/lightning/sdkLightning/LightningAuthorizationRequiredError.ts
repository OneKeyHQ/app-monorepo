import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

export class LightningAuthorizationRequiredError extends OneKeyLocalError {
  constructor() {
    super('Lightning authorization is required.');
  }
}
