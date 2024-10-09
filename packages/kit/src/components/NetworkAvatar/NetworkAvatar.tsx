import type { IImageProps, IXStackProps } from '@onekeyhq/components';
import { Icon, Image, XStack } from '@onekeyhq/components';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { LetterAvatar } from '../LetterAvatar';

export const NetworkAvatarBase = ({
  logoURI,
  size,
  isCustomNetwork,
  networkName,
}: {
  logoURI: string;
  size?: IImageProps['size'];
  isCustomNetwork?: boolean;
  networkName?: string;
}) => {
  if (isCustomNetwork) {
    return <LetterAvatar letter={networkName?.[0]} size={size} />;
  }
  return (
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
};

type INetworkAvatarProps = {
  networkId?: string;
  size?: IImageProps['size'];
  isCustomNetwork?: boolean;
};

export function NetworkAvatar({ networkId, size = '$6' }: INetworkAvatarProps) {
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
  const { logoURI, isCustomNetwork, name } = res.result || {};
  if (isCustomNetwork) {
    return <LetterAvatar letter={name?.[0]} size={size} />;
  }
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
