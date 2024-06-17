import type { IImageProps, IXStackProps } from '@onekeyhq/components';
import { Image, XStack } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';

export const AllNetworksAvatar = ({ size }: { size?: IImageProps['size'] }) => (
  <Image
    size={size}
    src="https://uni.onekey-asset.com/static/logo/chain_selector_logo.png"
  />
);

type INetworkAvatarProps = {
  networkId?: string;
  size?: IImageProps['size'];
};

export function NetworkAvatar({ networkId, size = '$6' }: INetworkAvatarProps) {
  const { serviceNetwork } = backgroundApiProxy;
  const res = usePromiseResult(
    () =>
      networkId
        ? serviceNetwork.getNetwork({ networkId })
        : Promise.resolve({ logoURI: '' }),
    [networkId, serviceNetwork],
    {
      checkIsFocused: false,
    },
  );
  const { logoURI } = res.result || {};
  return logoURI ? <Image size={size} src={logoURI} /> : null;
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
