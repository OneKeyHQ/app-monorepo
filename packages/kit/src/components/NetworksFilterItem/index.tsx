import { useCallback } from 'react';

import { StyleSheet } from 'react-native';

import {
  Icon,
  Image,
  SizableText,
  Tooltip,
  XStack,
} from '@onekeyhq/components';
import type { IImageProps, IXStackProps } from '@onekeyhq/components';

export type INetworksFilterItemProps = {
  networkImageUri?: string;
  networkName?: string;
  isSelected?: boolean;
  tooltipContent?: string;
  disabled?: boolean;
  isAllNetworks?: boolean;
} & IXStackProps;

export function NetworksFilterItem({
  networkImageUri,
  networkName,
  isSelected,
  tooltipContent,
  disabled,
  isAllNetworks,
  ...rest
}: INetworksFilterItemProps) {
  const renderNetworkImage = useCallback(() => {
    if (isAllNetworks) {
      return <Icon name="GlobusOutline" color="$iconActive" size="$6" />;
    }
    return networkImageUri ? (
      <Image
        size="$6"
        borderRadius="$full"
        $gtMd={
          {
            size: '$5',
          } as any
        }
        source={{
          uri: networkImageUri,
        }}
      />
    ) : null;
  }, [isAllNetworks, networkImageUri]);

  const BaseComponent = (
    <XStack
      justifyContent="center"
      px="$3"
      py="$1.5"
      borderRadius="$2"
      userSelect="none"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor={isSelected ? '$borderActive' : '$border'}
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
      {renderNetworkImage()}
      {networkName ? (
        <SizableText
          numberOfLines={1}
          color={isSelected ? '$text' : '$textSubdued'}
          size="$bodyLgMedium"
        >
          {networkName}
        </SizableText>
      ) : null}
    </XStack>
  );

  if (!tooltipContent) return BaseComponent;

  return (
    <Tooltip
      renderContent={tooltipContent}
      placement="top"
      renderTrigger={BaseComponent}
    />
  );
}
