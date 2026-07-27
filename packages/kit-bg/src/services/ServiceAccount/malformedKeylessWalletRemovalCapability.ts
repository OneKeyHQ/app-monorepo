import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IMalformedKeylessWalletFingerprint } from './keylessWalletRemovalCapability';

const malformedKeylessWalletRemovalCapabilityBrand = Symbol(
  'malformedKeylessWalletRemovalCapability',
);

export class MalformedKeylessWalletRemovalCapability {
  readonly [malformedKeylessWalletRemovalCapabilityBrand] = true;

  readonly expectedFingerprint: Readonly<IMalformedKeylessWalletFingerprint>;

  readonly operationId: string;

  readonly lifecycleRevision: number;

  private consumed = false;

  constructor({
    expectedFingerprint,
    operationId,
    lifecycleRevision,
  }: {
    expectedFingerprint: IMalformedKeylessWalletFingerprint;
    operationId: string;
    lifecycleRevision: number;
  }) {
    this.expectedFingerprint = Object.freeze({ ...expectedFingerprint });
    this.operationId = operationId;
    this.lifecycleRevision = lifecycleRevision;
  }

  consume({
    operationId,
    lifecycleRevision,
  }: {
    operationId: string;
    lifecycleRevision: number;
  }) {
    if (
      this.consumed ||
      operationId !== this.operationId ||
      lifecycleRevision !== this.lifecycleRevision
    ) {
      throw new OneKeyLocalError(
        'The malformed Keyless wallet removal authorization is invalid or already used.',
      );
    }
    this.consumed = true;
  }
}
