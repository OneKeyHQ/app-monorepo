import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { isThirdPartyPassphraseAlwaysOnDeviceErrorCode } from '@onekeyhq/shared/src/errors/utils/thirdPartyDeviceErrorUtils';
import type { PromiseTarget } from '@onekeyhq/shared/src/utils/promiseUtils';
import { createPromiseTarget } from '@onekeyhq/shared/src/utils/promiseUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import type {
  IHwAllNetworkPrepareAccountsItem,
  IHwSdkNetwork,
} from '../../vaults/types';

export class HardwareAllNetworkGetAddressResponse {
  uuid = stringUtils.generateUUID();

  private sdkResponseCompleted = false;

  private respondedKeys = new Set<string>();

  private buildMissingResponseError() {
    return new OneKeyLocalError(
      'SDK all-network response is missing requested address',
    );
  }

  onSdkItemCallResponse(item: IHwAllNetworkPrepareAccountsItem) {
    const key = this.buildItemPromiseTargetKey({
      path: item.path,
      hwSdkNetwork: item.network,
      useTweak: item.useTweak,
    });
    this.respondedKeys.add(key);
    const promiseTarget = this.getOrCreateItemPromiseTarget({
      path: item.path,
      hwSdkNetwork: item.network,
      useTweak: item.useTweak,
    });
    if (
      item.success ||
      isThirdPartyPassphraseAlwaysOnDeviceErrorCode(item.payload?.code)
    ) {
      // Keep this operation-level failure as response data. Each network
      // consumer handles it when read; rejecting every pre-created target here
      // reports unhandled promises before those consumers can await them.
      promiseTarget.resolveTarget(item);
      return;
    }
    const error = convertDeviceError({
      code: item.payload?.code,
      error: item.payload?.error,
      params: item.payload?.params,
      connectId: item.payload?.connectId,
      deviceId: item.payload?.deviceId,
    });
    promiseTarget.rejectTarget(error);
  }

  onSdkResponse({
    items,
    completed,
  }: {
    items: IHwAllNetworkPrepareAccountsItem[];
    completed: boolean;
  }) {
    for (const item of items) {
      this.onSdkItemCallResponse(item);
    }
    if (completed) {
      this.completeSdkResponse();
    }
  }

  completeSdkResponse() {
    this.sdkResponseCompleted = true;
    Object.entries(this.promiseTargets).forEach(([key, target]) => {
      if (!this.respondedKeys.has(key)) {
        target.rejectTarget(this.buildMissingResponseError());
      }
    });
  }

  _rejectAllResponseError: IOneKeyError | undefined = undefined;

  rejectAllResponse(error: IOneKeyError) {
    this._rejectAllResponseError = error;
    Object.values(this.promiseTargets).forEach((target) => {
      target.rejectTarget(error);
    });
  }

  destroy() {
    console.log('HardwareAllNetworkGetAddressResponse__destroy', {
      uuid: this.uuid,
    });
    this.promiseTargets = {};
    this.bundleLength = 0;
    this._rejectAllResponseError = undefined;
    this.sdkResponseCompleted = false;
    this.respondedKeys.clear();
  }

  promiseTargets: Record<
    string,
    PromiseTarget<IHwAllNetworkPrepareAccountsItem>
  > = {};

  getOrCreateItemPromiseTarget({
    path,
    hwSdkNetwork,
    useTweak,
  }: {
    path: string;
    hwSdkNetwork: IHwSdkNetwork;
    useTweak?: boolean;
  }) {
    const key = this.buildItemPromiseTargetKey({
      path,
      hwSdkNetwork,
      useTweak,
    });
    console.log(
      'HardwareAllNetworkGetAddressResponse__getOrCreateItemPromiseTarget',
      {
        key,
        uuid: this.uuid,
      },
    );
    if (!this.promiseTargets[key]) {
      const promiseTarget =
        createPromiseTarget<IHwAllNetworkPrepareAccountsItem>();
      this.promiseTargets[key] = promiseTarget;
    }
    const promiseTarget = this.promiseTargets[key];

    if (this._rejectAllResponseError) {
      promiseTarget.rejectTarget(this._rejectAllResponseError);
    } else if (this.sdkResponseCompleted && !this.respondedKeys.has(key)) {
      promiseTarget.rejectTarget(this.buildMissingResponseError());
    }

    return promiseTarget;
  }

  buildItemPromiseTargetKey({
    path,
    hwSdkNetwork,
    useTweak,
  }: {
    path: string;
    hwSdkNetwork: IHwSdkNetwork;
    useTweak?: boolean;
  }) {
    /*
        const account = hwAllNetworkPrepareAccountsResponse?.find(
        (item) =>
        item.network && item.path === path && item.network === hwSdkNetwork,
        );
        */

    if (useTweak) {
      return `PromiseItem__${hwSdkNetwork}-${path}-useTweak`;
    }
    return `PromiseItem__${hwSdkNetwork}-${path}`;
  }

  _bundleLength = 0;

  get bundleLength() {
    return this._bundleLength;
  }

  set bundleLength(length: number) {
    this._bundleLength = length;
  }

  async getItem({
    path,
    hwSdkNetwork,
    useTweak,
  }: {
    path: string;
    hwSdkNetwork: IHwSdkNetwork;
    useTweak?: boolean;
  }): Promise<IHwAllNetworkPrepareAccountsItem> {
    const promiseTarget = this.getOrCreateItemPromiseTarget({
      path,
      hwSdkNetwork,
      useTweak,
    });
    return promiseTarget.ready;
  }

  async getAllItems(): Promise<IHwAllNetworkPrepareAccountsItem[]> {
    const promiseTargets = Object.values(this.promiseTargets);
    const items = await Promise.all(
      promiseTargets.map((target) => target.ready),
    );
    return items;
  }

  async getFirstErrorItem(): Promise<
    IHwAllNetworkPrepareAccountsItem | undefined
  > {
    const items = await this.getAllItems();
    /*
     const hasErrorItem = hwAllNetworkPrepareAccountsResponse?.find(
        (item) => !item.success && !!item.payload?.error,
        );
        */
    const errorItem = items.find(
      (item) => !item.success && !!item.payload?.error,
    );
    return errorItem || undefined;
  }
}
