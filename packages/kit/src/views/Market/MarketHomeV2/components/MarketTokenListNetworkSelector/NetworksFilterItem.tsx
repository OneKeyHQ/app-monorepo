import { StyleSheet } from 'react-native';

import { Image, SizableText, XStack } from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';

export type INetworksFilterItemProps = {
  networkImageUri?: string;
  networkName?: string;
  isSelected?: boolean;
  disabled?: boolean;
} & IXStackProps;

export function NetworksFilterItem({
  networkImageUri,
  networkName,
  isSelected,
  disabled,
  ...rest
}: INetworksFilterItemProps) {
  return (
    <XStack
      justifyContent="center"
      px="$2.5"
      py="$1.5"
      gap="$2"
      borderRadius="$2"
      userSelect="none"
      backgroundColor={isSelected ? '$bgActive' : '$transparent'}
      {...(!isSelected &&
        !disabled && {
          focusable: true,
          hoverStyle: {
            bg: '$bgStrongHover',
          },
          pressStyle: {
            bg: '$bgStrongActive',
          },
          focusVisibleStyle: {
            outlineWidth: 2,
            outlineStyle: 'solid',
            outlineColor: '$focusRing',
          },
        })}
      {...(disabled && {
        opacity: 0.5,
      })}
      {...rest}
    >
      {networkImageUri ? (
        <Image
          height="$6"
          width="$6"
          borderRadius="$full"
          $gtMd={{
            height: '$5',
            width: '$5',
          }}
        >
          <Image.Source
            source={{
              uri: networkImageUri,
            }}
          />
        </Image>
      ) : null}
      {networkName ? (
        <SizableText
          numberOfLines={1}
          color={isSelected ? '$text' : '$textSubdued'}
          size="$bodyLgMedium"
          $gtMd={{
            size: '$bodyMdMedium',
          }}
        >
          {networkName}
        </SizableText>
      ) : null}
    </XStack>
  );
}
