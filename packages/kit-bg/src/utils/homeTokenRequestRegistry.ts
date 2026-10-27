import { CanceledError } from 'axios';

import {
  getAdvertisedHomeTokenMainRuntimeId,
  isNativeHomeTokenRequestEnabled,
} from '@onekeyhq/shared/src/utils/homeTokenRequest';
import type {
  IHomeTokenRequest,
  IHomeTokenRequestInvalidation,
} from '@onekeyhq/shared/types/token';

export class HomeTokenRequestRegistry {
  private current:
    | (IHomeTokenRequestInvalidation & { ownerKey?: string })
    | undefined;

  constructor(
    private getMainRuntimeId = getAdvertisedHomeTokenMainRuntimeId,
    private isEnabled = isNativeHomeTokenRequestEnabled,
  ) {}

  private assertRuntime(request: IHomeTokenRequestInvalidation) {
    if (
      request.mainRuntimeId !== this.getMainRuntimeId() ||
      !Number.isSafeInteger(request.generation) ||
      request.generation <= 0
    ) {
      throw new CanceledError('Home token request runtime expired');
    }
  }

  claim(request: IHomeTokenRequest | undefined) {
    if (!request || !this.isEnabled()) return;
    this.assertRuntime(request);
    if (!request.ownerKey) throw new CanceledError('Home token owner missing');
    if (
      !this.current ||
      this.current.mainRuntimeId !== request.mainRuntimeId ||
      request.generation > this.current.generation
    ) {
      this.current = { ...request };
    }
    this.assertCurrent(request);
  }

  invalidate(request: IHomeTokenRequestInvalidation) {
    if (!this.isEnabled()) return;
    this.assertRuntime(request);
    if (
      !this.current ||
      this.current.mainRuntimeId !== request.mainRuntimeId ||
      request.generation >= this.current.generation
    ) {
      // A tombstone cannot be revived by a delayed begin of the same round.
      this.current = {
        mainRuntimeId: request.mainRuntimeId,
        generation: request.generation,
      };
    }
  }

  cancel(request: IHomeTokenRequest) {
    if (this.isCurrent(request)) this.invalidate(request);
  }

  isCurrent(request: IHomeTokenRequest | undefined) {
    if (!request || !this.isEnabled()) return true;
    return (
      request.mainRuntimeId === this.getMainRuntimeId() &&
      this.current?.mainRuntimeId === request.mainRuntimeId &&
      this.current.generation === request.generation &&
      this.current.ownerKey === request.ownerKey &&
      !!request.ownerKey
    );
  }

  assertCurrent(
    request: IHomeTokenRequest | undefined,
    ownerKey = request?.ownerKey,
  ) {
    if (
      !this.isCurrent(request) ||
      (request && request.ownerKey !== ownerKey)
    ) {
      throw new CanceledError('Home token request superseded');
    }
  }
}

export const homeTokenRequestRegistry = new HomeTokenRequestRegistry();
