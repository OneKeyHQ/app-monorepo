/* eslint-disable no-nested-ternary */
import React, { ComponentProps, FC } from 'react';

import { Center, Icon, Image } from '@onekeyhq/components';
import ClassicIcon from '@onekeyhq/components/img/deviceIcon_classic.png';
import MiniIcon from '@onekeyhq/components/img/deviceIcon_mini.png';
import { Text } from '@onekeyhq/components/src/Typography';

type WalletAvatarProps = {
  size?: 'xl' | 'lg' | 'sm' | string;
  avatarBgColor?: string;
  walletImage?: string | 'classic' | 'mini' | 'imported' | 'watching' | 'hd';
  circular?: boolean;
} & ComponentProps<typeof Center>;

const defaultProps = {
  size: 'lg',
  avatarBgColor: 'surface-neutral-default',
  walletImage: '🤑',
  circular: false,
};

const WalletAvatar: FC<WalletAvatarProps> = ({
  size,
  avatarBgColor,
  walletImage,
  circular,
  ...rest
}) => {
  const WalletImage = () => {
    if (walletImage === 'classic' || walletImage === 'mini')
      return (
        <Image
          width={
            size === 'xl'
              ? '20'
              : size === 'lg'
              ? '20'
              : size === 'sm'
              ? '14'
              : undefined
          }
          height={
            size === 'xl'
              ? '30'
              : size === 'lg'
              ? '30'
              : size === 'sm'
              ? '21'
              : undefined
          }
          source={walletImage === 'classic' ? ClassicIcon : MiniIcon}
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

  return (
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
      <WalletImage />
    </Center>
  );
};

WalletAvatar.defaultProps = defaultProps;

export default WalletAvatar;
