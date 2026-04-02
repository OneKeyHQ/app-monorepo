import { useMemo } from 'react';

import {
  Icon,
  Image,
  SizableText,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';

export type INetworksFilterItemProps = {
  networkImageUri?: string;
  networkName?: string;
  isSelected?: boolean;
  disabled?: boolean;
  isAllNetworks?: boolean;
} & IXStackProps;

export function NetworksFilterItem({
  networkImageUri,
  networkName,
  isSelected,
  disabled,
  isAllNetworks,
  ...rest
}: INetworksFilterItemProps) {
  const { md } = useMedia();

  const iconElement = useMemo(() => {
    // Don't show icon on mobile unless selected
    if (md && !isSelected) {
      return null;
    }

    // Show AllNetworksSolid icon for "All Networks"
    if (isAllNetworks) {
      return <Icon name="AllNetworksSolid" size="$4.5" color="$iconActive" />;
    }

    // Show network logo for other networks
    if (networkImageUri) {
      return (
        <Image
          size="$4.5"
          width="$4.5"
          borderRadius="$full"
          source={{
            uri: networkImageUri,
          }}
        />
      );
    }

    return null;
  }, [md, isSelected, isAllNetworks, networkImageUri]);

  return (
    <XStack
      alignItems="center"
      justifyContent="center"
      px="$2.5"
      py="$1.5"
      gap={md ? '$1' : '$2'}
      borderRadius={md ? '$full' : '$2.5'}
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
      {iconElement}
      {networkName ? (
        <SizableText
          numberOfLines={1}
          color={isSelected ? '$text' : '$textSubdued'}
          size="$bodyMdMedium"
        >
          {networkName}
        </SizableText>
      ) : null}
    </XStack>
  );
}
