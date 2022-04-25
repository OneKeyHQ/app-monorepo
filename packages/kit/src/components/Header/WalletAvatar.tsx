/* eslint-disable no-nested-ternary */
import React, { ComponentProps, FC } from 'react';

import { Center, Icon, Image } from '@onekeyhq/components';
import ClassicIcon from '@onekeyhq/components/img/deviceIcon_classic.png';
import MiniIcon from '@onekeyhq/components/img/deviceIcon_mini.png';
import { Text } from '@onekeyhq/components/src/Typography';
import { IOneKeyDeviceType } from '@onekeyhq/shared/types';

type WalletAvatarProps = {
  size?: 'xl' | 'lg' | 'sm' | string;
  avatarBgColor?: string;
  walletImage?: string | 'hw' | 'imported' | 'watching' | 'hd';
  circular?: boolean;
  hwWalletType?: IOneKeyDeviceType;
} & ComponentProps<typeof Center>;

const defaultProps = {
  size: 'lg',
  avatarBgColor: 'surface-neutral-default',
  walletImage: '🤑',
  circular: false,
};

const WalletImage: FC<Partial<WalletAvatarProps>> = ({
  size,
  walletImage,
  hwWalletType,
}) => {
  if (
    walletImage === 'hw' &&
    (hwWalletType === 'classic' || hwWalletType === 'mini')
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
            : undefined
        }
        height={
          size === 'xl'
            ? '30px'
            : size === 'lg'
            ? '30px'
            : size === 'sm'
            ? '21px'
            : undefined
        }
        source={hwWalletType === 'classic' ? ClassicIcon : MiniIcon}
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
            : undefined
        }
      >
        🤑
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
          : undefined
      }
    >
      {walletImage}
    </Text>
  );
};

const WalletAvatar: FC<WalletAvatarProps> = ({
  size,
  avatarBgColor,
  walletImage,
  circular,
  hwWalletType,
  ...rest
}) => (
  <Center
    rounded={circular ? 'full' : 12}
    size={
      size === 'xl'
        ? '56px'
        : size === 'lg'
        ? 12
        : size === 'sm'
        ? 8
        : undefined
    }
    bgColor={avatarBgColor}
    {...rest}
    pointerEvents="none"
  >
    <WalletImage
      size={size}
      walletImage={walletImage}
      hwWalletType={hwWalletType}
    />
  </Center>
);

WalletAvatar.defaultProps = defaultProps;

export default WalletAvatar;
