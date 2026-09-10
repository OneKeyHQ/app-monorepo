import type {
  IDeviceCommonParams,
  IDeviceSharedCallParams,
  IHardwareOperationContext,
} from '@onekeyhq/shared/types/device';

import type { ICommonCallParams } from '@onekeyfe/hwk-adapter-core';

export function thirdPartyCommonCallParamsForCreateScene(scene: {
  isAutoCreateMultiNetwork?: boolean;
}): ICommonCallParams | undefined {
  return scene.isAutoCreateMultiNetwork ? { autoInstallApp: false } : undefined;
}

export function withHardwareOperationContext(
  deviceParams: IDeviceSharedCallParams,
  hardwareOperationContext: IHardwareOperationContext | undefined,
): IDeviceSharedCallParams {
  if (!hardwareOperationContext) {
    return deviceParams;
  }

  const deviceCommonParams: IDeviceCommonParams =
    deviceParams.deviceCommonParams ?? {
      passphraseState: undefined,
      useEmptyPassphrase: undefined,
    };
  return {
    ...deviceParams,
    deviceCommonParams: {
      ...deviceCommonParams,
      ...hardwareOperationContext,
    },
  };
}

export function thirdPartyPassphraseParamsFromDeviceParams(
  deviceParams: IDeviceSharedCallParams | undefined,
): {
  passphraseState?: string;
  useEmptyPassphrase?: boolean;
  interactionId?: string;
} {
  const passphraseState = deviceParams?.deviceCommonParams?.passphraseState;
  const useEmptyPassphrase =
    deviceParams?.deviceCommonParams?.useEmptyPassphrase;
  const interactionId = deviceParams?.deviceCommonParams?.interactionId;
  return {
    ...(passphraseState ? { passphraseState } : {}),
    ...(useEmptyPassphrase !== undefined ? { useEmptyPassphrase } : {}),
    ...(interactionId ? { interactionId } : {}),
  };
}
