import { EDeviceType } from '@onekeyfe/hd-shared';

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

export const HwWalletAvatarImages: Record<
  IDeviceType | `${EDeviceType.Pro}Black` | `${EDeviceType.Pro}White`,
  ImageSourcePropType
> = {
  [EDeviceType.Unknown]: { uri: undefined },
  [EDeviceType.Classic]: require('../assets/wallet/avatar/Classic.png'),
  [EDeviceType.Classic1s]: require('../assets/wallet/avatar/Classic.png'),
  [EDeviceType.ClassicPure]: require('../assets/wallet/avatar/ClassicPure.png'),
  [EDeviceType.Mini]: require('../assets/wallet/avatar/Mini.png'),
  [EDeviceType.Touch]: require('../assets/wallet/avatar/Touch.png'),
  [EDeviceType.Pro]: require('../assets/wallet/avatar/ProBlack.png'),
  [`${EDeviceType.Pro}Black`]: require('../assets/wallet/avatar/ProBlack.png'),
  [`${EDeviceType.Pro}White`]: require('../assets/wallet/avatar/ProWhite.png'),
};

export const OthersWalletAvatarImages = {
  othersExternal: require('../assets/wallet/avatar/others-external.png'),
  othersImported: require('../assets/wallet/avatar/others-imported.png'),
  othersWatching: require('../assets/wallet/avatar/others-watching.png'),
};

export const AllWalletAvatarImages = {
  cardDividers: require('../assets/wallet/avatar/CardDividers.png'),
  ...OthersWalletAvatarImages,
  ...HdWalletAvatarImages,
  ...HwWalletAvatarImages,
};

export type IAllWalletAvatarImageNames = keyof typeof AllWalletAvatarImages;
export type IHdWalletAvatarImageNames = keyof typeof HdWalletAvatarImages;
export type IHwWalletAvatarImageNames = keyof typeof HwWalletAvatarImages;
export type IOthersWalletAvatarImageNames =
  keyof typeof OthersWalletAvatarImages;

export function getDeviceAvatarImage(
  deviceType: IDeviceType,
  serialNo?: string,
): IDeviceType | `${EDeviceType.Pro}Black` | `${EDeviceType.Pro}White` {
  if (deviceType === EDeviceType.Pro) {
    if (serialNo && serialNo?.startsWith('PR') && serialNo?.endsWith('B')) {
      return `${EDeviceType.Pro}White`;
    }
    return `${EDeviceType.Pro}Black`;
  }
  return deviceType;
}
