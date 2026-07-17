import { EDeviceType } from '@onekeyfe/hd-shared';

import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes/onboardingv2';
import { isEncodedSensitiveText } from '@onekeyhq/shared/src/utils/sensitiveTextUtils';
import { EConnectDeviceChannel } from '@onekeyhq/shared/types/connectDevice';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

type IRecoveryPhraseRouteParams = IOnboardingParamListV2['ShowRecoveryPhrase'];
type IConnectYourDeviceRouteParams =
  IOnboardingParamListV2['ConnectYourDevice'];
type ICheckAndUpdateRouteParams = IOnboardingParamListV2['CheckAndUpdate'];

const deviceTypes = new Set<string>(Object.values(EDeviceType));
const hardwareVendors = new Set<string>(Object.values(EHardwareVendor));
const connectDeviceChannels = new Set<string>(
  Object.values(EConnectDeviceChannel),
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const isValidRecoveryPhraseRouteParams = (
  params: unknown,
): params is IRecoveryPhraseRouteParams => {
  if (!isRecord(params)) {
    return false;
  }
  return (
    typeof params.mnemonic === 'string' &&
    isEncodedSensitiveText(params.mnemonic) &&
    typeof params.walletId === 'string' &&
    params.walletId.length > 0 &&
    (params.accountName === undefined || typeof params.accountName === 'string')
  );
};

export const isValidConnectYourDeviceRouteParams = (
  params: unknown,
): params is IConnectYourDeviceRouteParams => {
  if (!isRecord(params) || !Array.isArray(params.deviceType)) {
    return false;
  }
  return (
    params.deviceType.every(
      (deviceType) =>
        typeof deviceType === 'string' && deviceTypes.has(deviceType),
    ) &&
    (params.vendor === undefined ||
      (typeof params.vendor === 'string' && hardwareVendors.has(params.vendor)))
  );
};

export const isValidCheckAndUpdateRouteParams = (
  params: unknown,
): params is ICheckAndUpdateRouteParams => {
  if (!isRecord(params) || !isRecord(params.deviceData)) {
    return false;
  }
  return (
    isRecord(params.deviceData.device) &&
    typeof params.tabValue === 'string' &&
    connectDeviceChannels.has(params.tabValue)
  );
};
