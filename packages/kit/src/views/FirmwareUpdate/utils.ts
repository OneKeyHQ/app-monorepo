import { EFirmwareType } from '@onekeyfe/hd-shared';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

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
