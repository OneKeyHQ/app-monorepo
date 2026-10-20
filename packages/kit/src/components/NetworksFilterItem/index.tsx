import { useCallback } from 'react';

import { StyleSheet } from 'react-native';

import {
  Badge,
  Icon,
  Image,
  SizableText,
  Tooltip,
  XStack,
} from '@onekeyhq/components';
import type {
  IKeyOfIcons,
  IXStackProps,
  SizeTokens,
} from '@onekeyhq/components';
import type { ISizableTextProps } from '@onekeyhq/components/src/primitives';

export type INetworksFilterItemProps = {
  networkImageUri?: string;
  networkImageSize?: SizeTokens;
  networkName?: string;
  iconAfter?: IKeyOfIcons;
  isSelected?: boolean;
  tooltipContent?: string;
  disabled?: boolean;
  isAllNetworks?: boolean;
  badgeText?: string;
  keepNetworkImageSize?: boolean;
  networkNameProps?: ISizableTextProps;
} & IXStackProps;

export function NetworksFilterItem({
  networkImageUri,
  networkImageSize = '$6',
  networkName,
  iconAfter,
  isSelected,
  tooltipContent,
  disabled,
  isAllNetworks,
  badgeText,
  keepNetworkImageSize,
  networkNameProps,
  ...rest
}: INetworksFilterItemProps) {
  const renderNetworkImage = useCallback(() => {
    if (isAllNetworks) {
      return (
        <Icon
          name="AllNetworksSolid"
          color="$iconActive"
          size={networkImageSize}
        />
      );
    }
    return networkImageUri ? (
      <Image
        size={networkImageSize}
        borderRadius="$full"
        {...(!keepNetworkImageSize && {
          $gtMd: {
            size: '$5',
          } as any,
        })}
        source={{
          uri: networkImageUri,
        }}
      />
    ) : null;
  }, [isAllNetworks, keepNetworkImageSize, networkImageUri, networkImageSize]);

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
      {badgeText ? (
        <Badge badgeSize="sm" px="$1.5">
          <Badge.Text>{badgeText}</Badge.Text>
        </Badge>
      ) : null}
      {networkName ? (
        <SizableText
          numberOfLines={1}
          color={isSelected ? '$text' : '$textSubdued'}
          size="$bodyLgMedium"
          {...networkNameProps}
        >
          {networkName}
        </SizableText>
      ) : null}
      {iconAfter ? (
        <Icon name={iconAfter} size="$4" color="$iconSubdued" flexShrink={0} />
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
