import type { IDeviceType } from '@onekeyfe/hd-core';
import type { ImageSourcePropType } from 'react-native';

export const HdWalletAvatarImages = {
  bear: require('../assets/wallet/avatar/Bear.png'),
  cat: require('../assets/wallet/avatar/Cat.png'),
  cow: require('../assets/wallet/avatar/Cow.png'),
  dog: require('../assets/wallet/avatar/Dog.png'),
  fox: require('../assets/wallet/avatar/Fox.png'),
  frog: require('../assets/wallet/avatar/Frog.png'),
  koala: require('../assets/wallet/avatar/Koala.png'),
  lion: require('../assets/wallet/avatar/Lion.png'),
  monkey: require('../assets/wallet/avatar/Monkey.png'),
  panda: require('../assets/wallet/avatar/Panda.png'),
  pig: require('../assets/wallet/avatar/Pig.png'),
  polarBear: require('../assets/wallet/avatar/PolarBear.png'),
  rabbit: require('../assets/wallet/avatar/Rabbit.png'),
  raccoon: require('../assets/wallet/avatar/Raccoon.png'),
  tiger: require('../assets/wallet/avatar/Tiger.png'),
  wolf: require('../assets/wallet/avatar/Wolf.png'),
};
export const HdWalletAvatarImageNames = Object.keys(
  HdWalletAvatarImages,
) as IHdWalletAvatarImageNames[];

export const HwWalletAvatarImages: Record<IDeviceType, ImageSourcePropType> = {
  classic: require('../assets/wallet/avatar/Classic.png'),
  classic1s: require('../assets/wallet/avatar/Classic.png'),
  mini: require('../assets/wallet/avatar/Mini.png'),
  touch: require('../assets/wallet/avatar/Touch.png'),
  pro: require('../assets/wallet/avatar/Pro.png'),
};
export const AllWalletAvatarImages = {
  cardDividers: require('../assets/wallet/avatar/CardDividers.png'),
  ...HdWalletAvatarImages,
  ...HwWalletAvatarImages,
};

export type IAllWalletAvatarImageNames = keyof typeof AllWalletAvatarImages;
export type IHdWalletAvatarImageNames = keyof typeof HdWalletAvatarImages;
export type IHwWalletAvatarImageNames = keyof typeof HwWalletAvatarImages;
