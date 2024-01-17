/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import { slicePathTemplate } from '@onekeyhq/core/src/utils';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { OneKeyHardwareError } from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { HardwareSDK } from '@onekeyhq/shared/src/hardware/instance';
import type { IDeviceResponse } from '@onekeyhq/shared/types/device';

import { EVaultKeyringTypes } from '../types';

import { KeyringBase } from './KeyringBase';

import type { IPrepareHardwareAccountsParams } from '../types';

export type IWalletPassphraseState = {
  passphraseState?: string;
  useEmptyPassphrase?: boolean;
};

export abstract class KeyringHardwareBase extends KeyringBase {
  override keyringType: EVaultKeyringTypes = EVaultKeyringTypes.hardware;

  async getHardwareSDKInstance() {
    // Since the sdk instance can not pass the serializable testing in backgroundApiProxy
    // The direct call to backgroundApi is used here
    // This is a special case and direct access to backgroundApi is not recommended elsewhere.
    const sdk =
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      await global?.$backgroundApiProxy?.backgroundApi?.serviceHardware?.getSDKInstance?.();
    return (sdk as typeof HardwareSDK) ?? HardwareSDK;
  }

  async baseGetDeviceAccountPublicKeys<T>({
    params,
    usedIndexes,
    sdkGetPublicKeysFn,
  }: {
    params: IPrepareHardwareAccountsParams;
    usedIndexes: number[];
    sdkGetPublicKeysFn: (option: {
      connectId: string;
      deviceId: string;
      pathPrefix: string;
      pathSuffix: string;
      coinName: string | undefined;
      showOnOnekeyFn: (index: number) => boolean | undefined;
    }) => IDeviceResponse<Array<T>>;
  }) {
    const { deriveInfo, deviceParams } = params;
    const { dbDevice, confirmOnDevice } = deviceParams;
    const { connectId, deviceId } = dbDevice;
    const { template, coinName } = deriveInfo;
    const { pathPrefix, pathSuffix } = slicePathTemplate(template);

    let response;
    try {
      const showOnOnekeyFn = (arrIndex: number) =>
        !confirmOnDevice
          ? false
          : // confirm on last index account create
            arrIndex === usedIndexes[usedIndexes.length - 1];

      response = await sdkGetPublicKeysFn({
        connectId,
        deviceId,
        pathPrefix,
        pathSuffix,
        coinName,
        showOnOnekeyFn,
      });
    } catch (error: any) {
      console.error(error);
      throw new OneKeyHardwareError(error);
    }

    if (!response.success || !response.payload) {
      console.error(response.payload);
      throw convertDeviceError(response.payload);
    }

    if (response.payload.length !== usedIndexes.length) {
      throw new OneKeyInternalError('Unable to get publick key.');
    }
    return response.payload;
  }
}
