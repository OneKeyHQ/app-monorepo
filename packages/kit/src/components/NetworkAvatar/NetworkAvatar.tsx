import type { ComponentProps } from 'react';
import { useMemo } from 'react';

import type {
  IImageProps,
  IXStackProps,
  SizeTokens,
} from '@onekeyhq/components';
import { Badge, Icon, Image, Tooltip, XStack } from '@onekeyhq/components';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { LetterAvatar } from '../LetterAvatar';

import type { FontSizeTokens } from 'tamagui';

export const NetworkAvatarBase = ({
  logoURI,
  size,
  isCustomNetwork,
  networkName,
  isAllNetworks,
  allNetworksIconProps,
  isAggregateToken,
}: {
  logoURI: string;
  size?: IImageProps['size'];
  isCustomNetwork?: boolean;
  networkName?: string;
  isAllNetworks?: boolean;
  allNetworksIconProps?: ComponentProps<typeof Icon>;
  isAggregateToken?: boolean;
}) => {
  if (isCustomNetwork) {
    return <LetterAvatar letter={networkName?.[0]} size={size} />;
  }
  if (isAllNetworks || isAggregateToken) {
    if (size) {
      return (
        <Icon
          name="AllNetworksSolid"
          size={size as SizeTokens}
          color="$iconActive"
          {...allNetworksIconProps}
        />
      );
    }
    return (
      <Icon
        name="AllNetworksSolid"
        color="$iconActive"
        {...allNetworksIconProps}
      />
    );
  }
  return (
    <Image
      size={size}
      src={logoURI}
      borderRadius="$full"
      source={{ uri: logoURI }}
      fallback={
        <Icon
          size={size as FontSizeTokens}
          name="GlobusOutline"
          color="$iconSubdued"
        />
      }
    />
  );
};

type INetworkAvatarProps = {
  networkId?: string;
  size?: IImageProps['size'];
  isCustomNetwork?: boolean;
  allNetworksIconProps?: ComponentProps<typeof Icon>;
};

export function NetworkAvatar({
  networkId,
  size = '$6',
  allNetworksIconProps,
}: INetworkAvatarProps) {
  const { serviceNetwork } = backgroundApiProxy;
  const res = usePromiseResult(
    () =>
      networkId
        ? serviceNetwork.getNetwork({ networkId })
        : Promise.resolve({
            logoURI: '',
            isCustomNetwork: false,
            name: '',
          } as IServerNetwork),
    [networkId, serviceNetwork],
    {
      checkIsFocused: false,
    },
  );
  const { logoURI, isCustomNetwork, name, isAllNetworks } = res.result || {};

  if (isCustomNetwork) {
    return <LetterAvatar letter={name?.[0]} size={size} />;
  }

  if (networkUtils.isAggregateNetwork({ networkId })) {
    return (
      <NetworkAvatarBase
        size={size}
        isAggregateToken
        logoURI=""
        allNetworksIconProps={allNetworksIconProps}
      />
    );
  }

  return logoURI ? (
    <NetworkAvatarBase
      size={size}
      logoURI={logoURI}
      isAllNetworks={isAllNetworks}
      allNetworksIconProps={allNetworksIconProps}
    />
  ) : null;
}

type INetworkAvatarGroupProps = {
  networkIds?: INetworkAvatarProps['networkId'][];
  size?: INetworkAvatarProps['size'];
  variant?: 'overlapped' | 'spread';
  maxVisible?: number;
} & IXStackProps;

export function NetworkAvatarGroup({
  networkIds,
  size,
  variant = 'overlapped',
  maxVisible = 3,
  ...rest
}: INetworkAvatarGroupProps) {
  const visibleNetworks = useMemo(() => {
    if (!networkIds || !networkIds.length) return [];
    if (variant === 'spread' && networkIds.length > maxVisible) {
      return networkIds.slice(0, maxVisible);
    }
    return networkIds;
  }, [networkIds, maxVisible, variant]);

  const remainingCount = networkIds
    ? networkIds.length - visibleNetworks.length
    : 0;

  if (!networkIds || !networkIds.length) return null;

  if (variant === 'overlapped') {
    return (
      <XStack {...rest}>
        {networkIds.map((networkId, index) => (
          <XStack
            key={networkId}
            p="$0.5"
            borderRadius="$full"
            bg="$bgApp"
            {...(index !== 0 && {
              ml: '$-4',
            })}
          >
            <NetworkAvatar networkId={networkId} size={size || '$8'} />
          </XStack>
        ))}
      </XStack>
    );
  }

  // Spread variant with max visible and tooltip
  return (
    <XStack ai="center" gap="$1" {...rest}>
      {visibleNetworks.map((networkId) => (
        <NetworkAvatar key={networkId} networkId={networkId} size={size} />
      ))}
      {remainingCount > 0 ? (
        <Tooltip
          renderTrigger={
            <Badge badgeType="default" badgeSize="sm">
              <Badge.Text>+{remainingCount}</Badge.Text>
            </Badge>
          }
          renderContent={
            <XStack gap="$1" p="$1.5" flexWrap="wrap" maxWidth="$44">
              {networkIds
                ?.filter((id): id is string => !!id)
                .map((networkId) => (
                  <NetworkAvatar
                    key={networkId}
                    networkId={networkId}
                    size={size}
                  />
                ))}
            </XStack>
          }
        />
      ) : null}
    </XStack>
  );
}
