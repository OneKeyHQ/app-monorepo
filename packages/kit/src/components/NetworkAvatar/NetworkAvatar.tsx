import type { IImageProps, IXStackProps } from '@onekeyhq/components';
import { Icon, Image, XStack } from '@onekeyhq/components';
import { CHAIN_SELECTOR_LOGO } from '@onekeyhq/shared/src/config/appConfig';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';

export const NetworkAvatarBase = ({
  logoURI,
  size,
}: {
  logoURI: string;
  size?: IImageProps['size'];
}) => (
  <Image size={size} src={logoURI} borderRadius="$full">
    <Image.Source source={{ uri: logoURI }} />
    <Image.Fallback
      delayMs={1000}
      alignItems="center"
      justifyContent="center"
      bg="$gray5"
      padding="$1"
    >
      <Icon name="GlobusOutline" color="$iconSubdued" />
    </Image.Fallback>
  </Image>
);

export const AllNetworksAvatar = ({ size }: { size?: IImageProps['size'] }) => (
  <NetworkAvatarBase logoURI={CHAIN_SELECTOR_LOGO} size={size} />
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
  return logoURI ? <NetworkAvatarBase size={size} logoURI={logoURI} /> : null;
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
