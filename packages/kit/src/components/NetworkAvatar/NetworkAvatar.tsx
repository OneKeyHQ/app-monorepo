import type { ComponentProps } from 'react';

import type {
  IImageProps,
  IXStackProps,
  SizeTokens,
} from '@onekeyhq/components';
import { Icon, Image, XStack } from '@onekeyhq/components';
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
}: {
  logoURI: string;
  size?: IImageProps['size'];
  isCustomNetwork?: boolean;
  networkName?: string;
  isAllNetworks?: boolean;
  allNetworksIconProps?: ComponentProps<typeof Icon>;
}) => {
  if (isCustomNetwork) {
    return <LetterAvatar letter={networkName?.[0]} size={size} />;
  }
  if (isAllNetworks) {
    if (size) {
      return (
        <Icon
          name="GlobusOutline"
          color="$iconSubdued"
          size={size as SizeTokens}
          {...allNetworksIconProps}
        />
      );
    }
    return (
      <Icon
        name="GlobusOutline"
        color="$iconSubdued"
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
} & IXStackProps;

export function NetworkAvatarGroup({
  networkIds,
  size,
  ...rest
}: INetworkAvatarGroupProps) {
  if (!networkIds || !networkIds.length) return null;

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
