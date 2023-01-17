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
import { isPassphraseWallet } from '@onekeyhq/shared/src/engine/engineUtils';
import type { Avatar } from '@onekeyhq/shared/src/utils/emojiUtils';
import { defaultAvatar } from '@onekeyhq/shared/src/utils/emojiUtils';
import type { IOneKeyDeviceType } from '@onekeyhq/shared/types';

import { getDeviceTypeByDeviceId } from '../../utils/hardware';

import type {
  DeviceStatusType,
  IHardwareDeviceStatusMap,
} from '../NetworkAccountSelector/hooks/useDeviceStatusOfHardwareWallet';

type WalletAvatarProps = {
  size?: 'xl' | 'lg' | 'sm' | 'xs' | string;
  avatarBgColor?: string;
  walletImage?: string | 'hw' | 'imported' | 'watching' | 'hd' | 'external';
  circular?: boolean;
  hwWalletType?: IOneKeyDeviceType;
  avatar?: Avatar;
  status?: 'connected' | 'warning' | string | undefined;
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
}) => {
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
    let imgSource = ClassicIcon;
    if (hwWalletType === 'classic') {
      imgSource = ClassicIcon;
    }
    if (hwWalletType === 'mini') {
      imgSource = MiniIcon;
    }
    if (hwWalletType === 'touch') {
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

  const iconFontSizeMap: { [size: string]: number } = {
    'xs': 16,
    'sm': 20,
    'xl': 24,
    'lg': 24,
  };
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
      bgColor={status === 'warning' ? 'icon-warning' : 'interactive-default'}
      size={size === 'xl' || size === 'lg' ? '10px' : '8px'}
    />
  </Box>
);

const PassphraseStatus: FC<Partial<WalletAvatarProps>> = ({ size }) => (
  <Center
    position="absolute"
    right={-3}
    bottom={-3}
    borderColor="background-default"
    rounded="full"
    size={size === 'xl' || size === 'lg' ? '16px' : '12px'}
    bgColor="background-default"
  >
    <Icon
      name="LockClosedMini"
      color="icon-default"
      size={size === 'xl' || size === 'lg' ? 12 : 10}
    />
  </Center>
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
  const bgColor =
    avatarBgColor ||
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
      />
      {status ? <WalletStatus size={size} status={status} /> : undefined}
      {isPassphrase ? <PassphraseStatus size={size} /> : undefined}
    </Center>
  );
};

WalletAvatar.defaultProps = defaultProps;

const convertDeviceStatus = (status: DeviceStatusType | undefined) => {
  if (!status) return undefined;
  if (status?.hasUpgrade) return 'warning';
  if (status?.isConnected) return 'connected';
  return undefined;
};

export function useHardwareWalletInfo({
  deviceStatus,
  wallet,
}: {
  wallet: IWallet;
  deviceStatus: IHardwareDeviceStatusMap | undefined | null;
}) {
  const hwInfo = useMemo(() => {
    const { type } = wallet;
    const { deviceType } = wallet;
    const deviceId = wallet.associatedDevice || '';
    let isPassphrase = false;
    let status: string | undefined;
    let statusType: DeviceStatusType | undefined;
    if (type === WALLET_TYPE_HW) {
      statusType = deviceStatus?.[deviceId];
      // TODO how to test status?
      //    packages/kit/src/components/Header/AccountSelectorChildren/LeftSide.tsx #getWalletItemStatus()
      status = convertDeviceStatus(statusType); // hw status
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
      status,
      hwWalletType,
      statusType,
      hasUpgrade,
      isConnected,
    };
  }, [deviceStatus, wallet]);
  return hwInfo;
}

function WalletAvatarPro({
  wallet,
  deviceStatus, // get by useDeviceStatusOfHardwareWallet()
  ...others
}: {
  wallet: IWallet;
  deviceStatus: IHardwareDeviceStatusMap | undefined | null;
} & WalletAvatarProps) {
  const { avatar } = wallet;
  const walletImage = wallet.type;
  const avatarBgColor = avatar?.bgColor;

  const hwInfo = useHardwareWalletInfo({
    deviceStatus,
    wallet,
  });
  return (
    <WalletAvatar
      walletImage={walletImage}
      avatarBgColor={avatarBgColor}
      avatar={avatar}
      hwWalletType={hwInfo.hwWalletType}
      status={hwInfo.status}
      isPassphrase={hwInfo.isPassphrase}
      {...others}
    />
  );
}
export { WalletAvatarPro };
export default memo(WalletAvatar);
