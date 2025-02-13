import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types/device';

type ISpecItemProps = {
  title: string;
  value: string;
};

function SpecItem({ title, value }: ISpecItemProps) {
  return (
    <XStack justifyContent="space-between" alignItems="center" h="$9">
      <SizableText size="$headingSm" color="$text" textAlign="left">
        {title}
      </SizableText>
      <SizableText size="$bodyMdMedium" color="$textSubdued" textAlign="right">
        {value}
      </SizableText>
    </XStack>
  );
}

function DeviceSpecsSection({ data }: { data: IHwQrWalletWithDevice }) {
  const intl = useIntl();
  const featuresInfo =
    (data.device?.featuresInfo as IOneKeyDeviceFeatures) || {};

  return (
    <YStack gap="$1">
      <XStack ai="center" h="$9">
        <SizableText size="$headingSm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_device_info,
          })}
        </SizableText>
      </XStack>
      <YStack py="$3" px="$5" bg="$bgSubdued" borderRadius="$4">
        <SpecItem
          title={intl.formatMessage({
            id: ETranslations.global_model,
          })}
          value={data.device?.deviceType || '-'}
        />
        <SpecItem
          title={intl.formatMessage({
            id: ETranslations.global_serial_number,
          })}
          value={data.device?.deviceId || '-'}
        />
        <SpecItem
          title={intl.formatMessage({
            id: ETranslations.global_serial_number,
          })}
          value="-"
        />
        <SpecItem
          title={intl.formatMessage({
            id: ETranslations.global_bluetooth_firmware,
          })}
          value={data.device?.connectId || '-'}
        />
      </YStack>
    </YStack>
  );
}

export default DeviceSpecsSection;
