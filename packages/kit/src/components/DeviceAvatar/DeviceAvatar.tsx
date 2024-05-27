import type { SizeTokens } from '@onekeyhq/components';

import { WalletAvatar } from '../WalletAvatar';

import type { IDeviceType } from '@onekeyfe/hd-core';

export function DeviceAvatar({
  deviceType,
  size,
}: {
  size?: SizeTokens;
  deviceType: IDeviceType; // use img for WalletAvatarEdit
}) {
  return (
    <WalletAvatar
      img={deviceType || 'unknown'}
      wallet={undefined}
      size={size}
    />
  );
}
