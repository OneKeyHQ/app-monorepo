import { EFirmwareType } from '@onekeyfe/hd-shared';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { isProtocolV2ProductType } from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

import type { IntlShape } from 'react-intl';

export function getFirmwareUpdateDeviceTitle(
  result: ICheckAllFirmwareReleaseResult,
) {
  if (result.deviceType && isProtocolV2ProductType(result.deviceType)) {
    return (
      deviceUtils.getDefaultDeviceLabel(result.deviceType) || result.deviceName
    );
  }

  return result.deviceName;
}

export function isPro2SafeOSFirmwareUpdate(
  result: ICheckAllFirmwareReleaseResult | undefined,
) {
  if (!result || !isProtocolV2ProductType(result.deviceType)) {
    return false;
  }
  return (
    result.updateInfos?.firmware?.hasUpgrade === true ||
    result.pro2TargetsToUpdate?.some(
      (target) => target === 'app_v1' || target === 'app_v2',
    ) === true
  );
}

export function getTargetFirmwareTypeLabel({
  firmwareType,
  intl,
}: {
  firmwareType: EFirmwareType | undefined;
  intl: IntlShape;
}) {
  if (!firmwareType) {
    return '';
  }

  return intl.formatMessage({
    id:
      firmwareType === EFirmwareType.BitcoinOnly
        ? ETranslations.device_firmware_type_btc_only__label
        : ETranslations.device_firmware_type_multichain__label,
  });
}
