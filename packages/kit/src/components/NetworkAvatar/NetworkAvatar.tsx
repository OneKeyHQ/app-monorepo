import type { IImageProps, IXStackProps } from '@onekeyhq/components';
import { Icon, Image, XStack } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { LetterAvatar } from '../LetterAvatar';

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

type INetworkAvatarProps = {
  networkId?: string;
  size?: IImageProps['size'];
  isCustomNetwork?: boolean;
};

export function NetworkAvatar({
  networkId,
  size = '$6',
  isCustomNetwork = false,
}: INetworkAvatarProps) {
  const { serviceNetwork } = backgroundApiProxy;
  const res = usePromiseResult(
    () =>
      !isCustomNetwork && networkId
        ? serviceNetwork.getNetwork({ networkId })
        : Promise.resolve({ logoURI: '' }),
    [isCustomNetwork, networkId, serviceNetwork],
    {
      checkIsFocused: false,
    },
  );
  if (isCustomNetwork) {
    return <LetterAvatar letter={networkId?.[0]} size={size} />;
  }
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
