import type { IXStackProps } from '@onekeyhq/components';
import { SizableText, XStack, YStack } from '@onekeyhq/components';

import { DeviceAvatar } from '../DeviceAvatar/DeviceAvatar';

import type { IDeviceType } from '@onekeyfe/hd-core';

export interface IDeviceInfoCardProps {
  deviceType?: IDeviceType;
  walletName?: string;
  bleName?: string;
}

export function DeviceInfoCard({
  deviceType,
  walletName,
  bleName,
  ...rest
}: IDeviceInfoCardProps & Omit<IXStackProps, 'children'>) {
  if (!deviceType || (!walletName && !bleName)) {
    return null;
  }

  return (
    <XStack
      alignItems="center"
      gap="$1"
      p="$1"
      pr="$2"
      bg="$bg"
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius="$2"
      {...rest}
    >
      <DeviceAvatar deviceType={deviceType} size="$7" />
      <YStack maxWidth="$28">
        {walletName ? (
          <SizableText size="$bodySmMedium" color="$text" numberOfLines={1}>
            {walletName}
          </SizableText>
        ) : null}
        {bleName ? (
          <SizableText size="$bodySm" color="$textSubdued">
            {bleName}
          </SizableText>
        ) : null}
      </YStack>
    </XStack>
  );
}
