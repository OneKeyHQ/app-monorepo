import type { SizeTokens } from '@onekeyhq/components';
import { getDeviceAvatarImage } from '@onekeyhq/shared/src/utils/avatarUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types/device';

import { WalletAvatar } from '../WalletAvatar';

import type { IDeviceType } from '@onekeyfe/hd-core';

export function DeviceAvatarWithColor({
  deviceType,
  features,
  size,
}: {
  deviceType: IDeviceType;
  features?: IOneKeyDeviceFeatures;
  size?: SizeTokens;
}) {
  const img = getDeviceAvatarImage(
    deviceType,
    deviceUtils.getDeviceSerialNoFromFeatures(features),
  );

  return <WalletAvatar img={img} wallet={undefined} size={size} />;
}

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
