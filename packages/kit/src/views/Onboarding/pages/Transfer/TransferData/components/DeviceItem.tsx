import { useIntl } from 'react-intl';

import type { IIconProps } from '@onekeyhq/components';
import { Badge, Icon, SizableText, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface IDeviceItemProps {
  deviceName: string;
  deviceType: string;
  iconName?: IIconProps['name'];
  isCurrentDevice?: boolean;
}

export function DeviceItem({
  deviceName,
  deviceType,
  iconName = 'PhoneOutline',
  isCurrentDevice = false,
}: IDeviceItemProps) {
  const intl = useIntl();

  return (
    <XStack gap="$3" alignItems="center" justifyContent="space-between">
      <Stack bg="$bgStrong" p="$2" borderRadius="$3">
        <Icon name={iconName} size="$6" color="$icon" />
      </Stack>

      <Stack flex={1}>
        <SizableText color="$text" size="$bodyLgMedium">
          {deviceName}
        </SizableText>

        <SizableText color="$textSubdued" size="$bodyMd">
          {deviceType}
        </SizableText>
      </Stack>

      {isCurrentDevice ? (
        <Badge badgeSize="lg">
          {intl.formatMessage({
            id: ETranslations.global_current,
          })}
        </Badge>
      ) : null}
    </XStack>
  );
}
