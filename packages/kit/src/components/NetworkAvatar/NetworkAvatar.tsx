import type { IImageProps } from '@onekeyhq/components';
import { Image, XStack } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';

export function NetworkAvatar({
  networkId,
  size = '$6',
}: {
  networkId?: string;
  size?: IImageProps['size'];
}) {
  const { serviceNetwork } = backgroundApiProxy;
  const res = usePromiseResult(
    () =>
      networkId
        ? serviceNetwork.getNetwork({ networkId })
        : Promise.resolve({ logoURI: '' }),
    [networkId, serviceNetwork],
  );
  const { logoURI } = res.result || {};
  return logoURI ? <Image size={size} src={logoURI} /> : null;
}

export function NetworkAvatarGroup({
  networkIds,
  size,
}: {
  networkIds: string[];
  size?: IImageProps['size'];
}) {
  if (!networkIds || !networkIds.length) return null;

  return (
    <XStack>
      {networkIds.map((networkId) => (
        <NetworkAvatar key={networkId} networkId={networkId} size={size} />
      ))}
    </XStack>
  );
}
