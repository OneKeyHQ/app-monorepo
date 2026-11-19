import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types/device';

import type { EFirmwareType } from '@onekeyfe/hd-shared';

type IFirmwareTypeCacheFeatures = Partial<
  Pick<IOneKeyDeviceFeatures, 'vendor' | 'capabilities'>
> & {
  $app_firmware_type?: EFirmwareType;
  fw_vendor?: string | null;
  unit_btconly?: boolean;
};

export function buildBtcOnlyFirmwareCacheKey({
  walletId,
  featuresInfo,
}: {
  walletId: string;
  featuresInfo?: IFirmwareTypeCacheFeatures;
}) {
  return [
    walletId,
    featuresInfo?.vendor ?? '',
    featuresInfo?.fw_vendor ?? '',
    featuresInfo?.capabilities?.join(',') ?? '',
    String(featuresInfo?.unit_btconly ?? ''),
    featuresInfo?.$app_firmware_type ?? '',
  ].join('\u0000');
}
