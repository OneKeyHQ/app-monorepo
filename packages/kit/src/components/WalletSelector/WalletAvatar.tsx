/* eslint-disable no-nested-ternary */
import type { ComponentProps, FC } from 'react';
import { memo, useMemo } from 'react';

import { Box, Center, Icon, Image, Text } from '@onekeyhq/components';
import ClassicIcon from '@onekeyhq/components/img/deviceIcon_classic.png';
import MiniIcon from '@onekeyhq/components/img/deviceIcon_mini.png';
import TouchIcon from '@onekeyhq/components/img/deviceicon_touch.png';
import type { TypographyStyle } from '@onekeyhq/components/src/Typography';
import type { IWallet } from '@onekeyhq/engine/src/types';
import { WALLET_TYPE_HW } from '@onekeyhq/engine/src/types/wallet';
import { getDeviceTypeByDeviceId } from '@onekeyhq/kit/src/utils/hardware';
import { isPassphraseWallet } from '@onekeyhq/shared/src/engine/engineUtils';
import type { Avatar } from '@onekeyhq/shared/src/utils/emojiUtils';
import { defaultAvatar } from '@onekeyhq/shared/src/utils/emojiUtils';
import type { IOneKeyDeviceType } from '@onekeyhq/shared/types';

import type {
  DeviceStatusType,
  IHardwareDeviceStatusMap,
} from '../NetworkAccountSelector/hooks/useDeviceStatusOfHardwareWallet';
import type { IDeviceType } from '@onekeyfe/hd-core';

type WalletAvatarProps = {
  size?: 'xl' | 'lg' | 'sm' | 'xs' | string;
  avatarBgColor?: string;
  walletImage?: string | 'hw' | 'imported' | 'watching' | 'hd' | 'external';
  circular?: boolean;
  hwWalletType?: IOneKeyDeviceType;
  avatar?: Avatar;
  status?: DeviceState;
  isPassphrase?: boolean;
} & ComponentProps<typeof Center>;

const defaultProps: WalletAvatarProps = {
  size: 'lg',
  circular: false,
};

const WalletImage: FC<Partial<WalletAvatarProps>> = ({
  size,
  walletImage,
  hwWalletType,
  avatar,
  isPassphrase,
}) => {
  const iconFontSizeMap: { [size: string]: number } = {
    'xs': 16,
    'sm': 20,
    'xl': 24,
    'lg': 24,
  };

  if (
    // ['classic', 'mini', 'touch'].includes(hwWalletType || '') &&
    walletImage === 'hw'
  ) {
    const sizeMap: {
      [size: string]: {
        width: string;
        height: string;
      };
    } = {
      'xl': {
        width: '20px',
        height: '30px',
      },
      'lg': {
        width: '20px',
        height: '30px',
      },
      'sm': {
        width: '14px',
        height: '21px',
      },
      'xs': {
        width: '12px',
        height: '18px',
      },
    };

    if (isPassphrase) {
      return (
        <Icon
          name="LockClosedSolid" // LockClosedSolid
          size={iconFontSizeMap[(size as string) ?? 'lg'] ?? 24}
          color="icon-subdued"
        />
      );
    }

    let imgSource = ClassicIcon;
    if (hwWalletType === 'classic' || hwWalletType === 'classic1s') {
      imgSource = ClassicIcon;
    }
    if (hwWalletType === 'mini') {
      imgSource = MiniIcon;
    }
    if (hwWalletType === 'touch' || hwWalletType === 'pro') {
      imgSource = TouchIcon;
    }

    return (
      <Image
        key={hwWalletType}
        width={sizeMap[size as string]?.width}
        height={sizeMap[size as string]?.height}
        source={imgSource}
      />
    );
  }

  if (walletImage === 'imported' || walletImage === 'watching')
    return (
      <Icon
        name={
          walletImage === 'imported' ? 'InboxArrowDownOutline' : 'EyeOutline'
        }
        size={iconFontSizeMap[(size as string) ?? 'lg'] ?? 24}
        color="icon-default"
      />
    );
  if (walletImage === 'external') {
    return (
      <Icon
        name="LinkOutline" // LinkOutline LinkOutline
        size={iconFontSizeMap[(size as string) ?? 'lg'] ?? 24}
        color="icon-default"
      />
    );
  }

  const textFontSizeMap: { [size: string]: TypographyStyle } = {
    xl: 'DisplayXLarge',
    lg: 'DisplayLarge',
    sm: 'DisplayMedium',
    xs: 'Body1',
  };
  if (walletImage === 'hd') {
    return (
      <Text typography={textFontSizeMap[size as string]}>{avatar?.emoji}</Text>
    );
  }

  // fallback to Text as Icon:
  //    'hw' | 'imported' | 'watching' | 'hd' | 'external'
  return (
    <Text typography={textFontSizeMap[size as string]}>{walletImage}</Text>
  );
};

export const WalletStatus: FC<Partial<WalletAvatarProps>> = ({
  size,
  status,
}) => (
  <Box
    position="absolute"
    right={-2}
    top={-3}
    rounded="full"
    p="2px"
    bgColor="background-default"
  >
    <Box
      rounded="full"
      bgColor={status === 'upgrade' ? 'icon-highlight' : 'interactive-default'}
      size={size === 'xl' || size === 'lg' ? '10px' : '8px'}
    />
  </Box>
);

const WalletAvatar: FC<WalletAvatarProps> = ({
  size,
  avatarBgColor,
  walletImage,
  circular,
  hwWalletType,
  avatar,
  status,
  isPassphrase,
  ...rest
}) => {
  const hdAvatar = avatar ?? defaultAvatar;
  const bgColor = isPassphrase
    ? 'surface-neutral-default'
    : avatarBgColor ||
      (walletImage === 'hd' ? hdAvatar.bgColor : 'surface-neutral-default');
  return (
    <Center
      rounded={circular ? 'full' : size === 'xs' ? '6px' : '12px'}
      size={
        size === 'xl'
          ? '56px'
          : size === 'lg'
          ? 12
          : size === 'sm'
          ? 8
          : size === 'xs'
          ? 6
          : undefined
      }
      bgColor={bgColor}
      {...rest}
      pointerEvents="none"
    >
      <WalletImage
        size={size}
        walletImage={walletImage}
        hwWalletType={hwWalletType}
        avatar={hdAvatar}
        isPassphrase={isPassphrase}
      />
      {status ? <WalletStatus size={size} status={status} /> : undefined}
      {/* {isPassphrase ? <PassphraseStatus size={size} /> : undefined} */}
    </Center>
  );
};

WalletAvatar.defaultProps = defaultProps;

export const convertDeviceStatus = (status: DeviceStatusType | undefined) => {
  if (!status) return undefined;
  if (status?.isConnected && status?.hasUpgrade) return 'upgrade';
  if (status?.isConnected) return 'connected';
  return undefined;
};

export type DeviceState = 'connected' | 'upgrade' | undefined;

export type TypeHardwareWalletInfo = {
  isPassphrase: boolean;
  deviceStatus: DeviceState;
  hwWalletType: IDeviceType;
  statusType: DeviceStatusType | undefined;
  hasUpgrade: boolean;
  isConnected: boolean;
};

export function useHardwareWalletInfo({
  devicesStatus,
  wallet,
}: {
  wallet: IWallet;
  devicesStatus: IHardwareDeviceStatusMap | undefined | null;
}): TypeHardwareWalletInfo {
  const hwInfo = useMemo(() => {
    const { type } = wallet;
    const { deviceType } = wallet;
    const deviceId = wallet.associatedDevice || '';
    let isPassphrase = false;
    let deviceStatus: DeviceState;
    let statusType: DeviceStatusType | undefined;
    if (type === WALLET_TYPE_HW) {
      statusType = devicesStatus?.[deviceId];
      // TODO how to test status?
      //    packages/kit/src/components/Header/AccountSelectorChildren/LeftSide.tsx #getWalletItemStatus()
      deviceStatus = convertDeviceStatus(statusType); // hw status
      isPassphrase = isPassphraseWallet(wallet); // hw hiddenWallet
    }
    let hwWalletType = deviceType as IOneKeyDeviceType;
    if (!hwWalletType) {
      hwWalletType = getDeviceTypeByDeviceId(deviceId);
    }

    const hasUpgrade = Boolean(statusType?.hasUpgrade);
    const isConnected = Boolean(statusType?.isConnected);
    return {
      isPassphrase,
      deviceStatus,
      hwWalletType,
      statusType,
      hasUpgrade,
      isConnected,
    };
  }, [devicesStatus, wallet]);
  return hwInfo;
}

function WalletAvatarPro({
  wallet,
  devicesStatus, // get by useDeviceStatusOfHardwareWallet()
  ...others
}: {
  wallet: IWallet;
  devicesStatus: IHardwareDeviceStatusMap | undefined | null;
} & WalletAvatarProps) {
  const { avatar } = wallet;
  const walletImage = wallet.type;
  const avatarBgColor = avatar?.bgColor;

  const hwInfo = useHardwareWalletInfo({
    devicesStatus,
    wallet,
  });
  return (
    <WalletAvatar
      walletImage={walletImage}
      avatarBgColor={avatarBgColor}
      avatar={avatar}
      hwWalletType={hwInfo.hwWalletType}
      status={hwInfo.deviceStatus}
      isPassphrase={hwInfo.isPassphrase}
      {...others}
    />
  );
}
export { WalletAvatarPro };
export default memo(WalletAvatar);
