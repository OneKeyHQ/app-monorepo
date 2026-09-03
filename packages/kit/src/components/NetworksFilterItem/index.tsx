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
import type { IXStackProps } from '@onekeyhq/components';
import type { ISizableTextProps } from '@onekeyhq/components/src/primitives';

export type INetworksFilterItemProps = {
  networkImageUri?: string;
  networkName?: string;
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
  networkName,
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
      return <Icon name="AllNetworksSolid" color="$iconActive" size="$6" />;
    }
    return networkImageUri ? (
      <Image
        size="$6"
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
  }, [isAllNetworks, keepNetworkImageSize, networkImageUri]);

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
