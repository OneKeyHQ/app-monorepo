/* eslint-disable no-nested-ternary */
import React, { ComponentProps, FC, memo } from 'react';

import { Box, Center, Icon, Image } from '@onekeyhq/components';
import ClassicIcon from '@onekeyhq/components/img/deviceIcon_classic.png';
import MiniIcon from '@onekeyhq/components/img/deviceIcon_mini.png';
import TouchIcon from '@onekeyhq/components/img/deviceicon_touch.png';
import { Text } from '@onekeyhq/components/src/Typography';
import { IOneKeyDeviceType } from '@onekeyhq/shared/types';

import { Avatar, defaultAvatar } from '../../utils/emojiUtils';

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
    walletImage === 'hw' &&
    (hwWalletType === 'classic' ||
      hwWalletType === 'mini' ||
      hwWalletType === 'touch')
  )
    return (
      <Image
        width={
          size === 'xl'
            ? '20px'
            : size === 'lg'
            ? '20px'
            : size === 'sm'
            ? '14px'
            : size === 'xs'
            ? '12px'
            : undefined
        }
        height={
          size === 'xl'
            ? '30px'
            : size === 'lg'
            ? '30px'
            : size === 'sm'
            ? '21px'
            : size === 'xs'
            ? '18px'
            : undefined
        }
        source={
          hwWalletType === 'touch'
            ? TouchIcon
            : hwWalletType === 'classic'
            ? ClassicIcon
            : MiniIcon
        }
      />
    );
  if (walletImage === 'imported' || walletImage === 'watching')
    return (
      <Icon
        name={walletImage === 'imported' ? 'SaveOutline' : 'EyeOutline'}
        size={size === 'sm' ? 20 : 24}
        color="icon-default"
      />
    );
  if (walletImage === 'external') {
    return (
      <Icon
        name="ConnectOutline" // ConnectOutline LinkOutline
        size={size === 'sm' ? 20 : 24}
        color="icon-default"
      />
    );
  }
  if (walletImage === 'hd') {
    return (
      <Text
        typography={
          size === 'xl'
            ? 'DisplayXLarge'
            : size === 'lg'
            ? 'DisplayLarge'
            : size === 'sm'
            ? 'DisplayMedium'
            : size === 'xs'
            ? 'Body1'
            : undefined
        }
      >
        {avatar?.emoji}
      </Text>
    );
  }
  return (
    <Text
      typography={
        size === 'xl'
          ? 'DisplayXLarge'
          : size === 'lg'
          ? 'DisplayLarge'
          : size === 'sm'
          ? 'DisplayMedium'
          : size === 'xs'
          ? 'Body1'
          : undefined
      }
    >
      {walletImage}
    </Text>
  );
};

const WalletStatus: FC<Partial<WalletAvatarProps>> = ({ size, status }) => (
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
      name="LockClosedSolid"
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

export default memo(WalletAvatar);
