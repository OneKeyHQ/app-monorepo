import { EDeviceType } from '@onekeyfe/hd-shared';

import { MOCK_PRO2_DEVICE_TYPE } from './devicePro2Mock';

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
  | IDeviceType
  | `${EDeviceType.Pro}Black`
  | `${EDeviceType.Pro}White`
  // MOCK(pro2): literal keys until EDeviceType.Pro2 ships. `pro2` is the base
  // (default avatar); Black/Orange/Silver are the color variants. These equal
  // the future `${EDeviceType.Pro2}` template forms (Pro2 = 'pro2'), so
  // convergence is a literal -> template swap. See devicePro2Mock.ts.
  | 'pro2'
  | 'pro2Black'
  | 'pro2Orange'
  | 'pro2Silver',
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
  pro2: require('../assets/wallet/avatar/Pro2Black.png'),
  pro2Black: require('../assets/wallet/avatar/Pro2Black.png'),
  pro2Orange: require('../assets/wallet/avatar/Pro2Orange.png'),
  pro2Silver: require('../assets/wallet/avatar/Pro2Silver.png'),
};

export const OthersWalletAvatarImages = {
  othersExternal: require('../assets/wallet/avatar/others-external.png'),
  othersImported: require('../assets/wallet/avatar/others-imported.png'),
  othersWatching: require('../assets/wallet/avatar/others-watching.png'),
};

export const ThirdPartyWalletAvatarImages = {
  ledger: require('../assets/wallet/avatar/Ledger.png'),
};

export const AllWalletAvatarImages = {
  cardDividers: require('../assets/wallet/avatar/CardDividers.png'),
  ...OthersWalletAvatarImages,
  ...HdWalletAvatarImages,
  ...HwWalletAvatarImages,
  ...ThirdPartyWalletAvatarImages,
};

export type IAllWalletAvatarImageNames = keyof typeof AllWalletAvatarImages;
export type IHdWalletAvatarImageNames = keyof typeof HdWalletAvatarImages;
export type IHwWalletAvatarImageNames = keyof typeof HwWalletAvatarImages;
export type IOthersWalletAvatarImageNames =
  keyof typeof OthersWalletAvatarImages;

export type IAllWalletAvatarImageNamesWithoutDividers =
  | IHdWalletAvatarImageNames
  | IHwWalletAvatarImageNames
  | IOthersWalletAvatarImageNames;

export function getDeviceAvatarImage(
  deviceType: IDeviceType,
  serialNo?: string,
):
  | IDeviceType
  | `${EDeviceType.Pro}Black`
  | `${EDeviceType.Pro}White`
  | 'pro2Black'
  | 'pro2Orange'
  | 'pro2Silver' {
  if (deviceType === EDeviceType.Pro) {
    if (serialNo && serialNo?.startsWith('PR') && serialNo?.endsWith('B')) {
      return `${EDeviceType.Pro}White`;
    }
    return `${EDeviceType.Pro}Black`;
  }
  // MOCK(pro2): provisional serial_no -> color rule from the SDK dev (not yet
  // finalized). Last char of serial_no: B = Black, O = Orange, S = Silver
  // (e.g. PRT41B0225O -> Orange). Falls back to Black when unknown/missing.
  // Keyed off the shared mock device type until EDeviceType.Pro2 ships.
  if (deviceType === MOCK_PRO2_DEVICE_TYPE) {
    if (serialNo?.endsWith('O')) {
      return 'pro2Orange';
    }
    if (serialNo?.endsWith('S')) {
      return 'pro2Silver';
    }
    return 'pro2Black';
  }
  return deviceType;
}
