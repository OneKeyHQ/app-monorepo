import { EDeviceType } from '@onekeyfe/hd-shared';

import { EHardwareVendor } from '../../types/device';

import { NEO_DEVICE_TYPE } from './hardwareDeviceTypes';
import thirdPartyDeviceUtils from './thirdPartyDeviceUtils';

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
  [EDeviceType.Pro2]: require('../assets/wallet/avatar/ProBlack.png'),
  [NEO_DEVICE_TYPE]: require('../assets/wallet/avatar/ProBlack.png'),
  [`${EDeviceType.Pro}Black`]: require('../assets/wallet/avatar/ProBlack.png'),
  [`${EDeviceType.Pro}White`]: require('../assets/wallet/avatar/ProWhite.png'),
};

export const OthersWalletAvatarImages = {
  othersExternal: require('../assets/wallet/avatar/others-external.png'),
  othersImported: require('../assets/wallet/avatar/others-imported.png'),
  othersWatching: require('../assets/wallet/avatar/others-watching.png'),
};

export const ThirdPartyWalletAvatarImages = {
  ledger: require('../assets/wallet/avatar/LedgerNanoX.png'),
  trezor: require('../assets/wallet/avatar/TrezorSafe7.png'),
  TrezorModelOne: require('../assets/wallet/avatar/TrezorModelOne.png'),
  TrezorModelT: require('../assets/wallet/avatar/TrezorModelT.png'),
  TrezorSafe3: require('../assets/wallet/avatar/TrezorSafe3.png'),
  TrezorSafe5: require('../assets/wallet/avatar/TrezorSafe5.png'),
  TrezorSafe7: require('../assets/wallet/avatar/TrezorSafe7.png'),
  LedgerNanoS: require('../assets/wallet/avatar/LedgerNanoS.png'),
  LedgerNanoX: require('../assets/wallet/avatar/LedgerNanoX.png'),
  LedgerStax: require('../assets/wallet/avatar/LedgerStax.png'),
  LedgerFlex: require('../assets/wallet/avatar/LedgerFlex.png'),
  LedgerNanoGen5: require('../assets/wallet/avatar/LedgerNanoGen5.png'),
};

export const AllWalletAvatarImages = {
  cardDividers: require('../assets/wallet/avatar/CardDividers.png'),
  ...OthersWalletAvatarImages,
  ...HdWalletAvatarImages,
  ...HwWalletAvatarImages,
  ...ThirdPartyWalletAvatarImages,
};

export type IHdWalletAvatarImageNames = keyof typeof HdWalletAvatarImages;
export type IHwWalletAvatarImageNames = keyof typeof HwWalletAvatarImages;
export type IOthersWalletAvatarImageNames =
  keyof typeof OthersWalletAvatarImages;
export type IThirdPartyWalletAvatarImageNames =
  keyof typeof ThirdPartyWalletAvatarImages;

export type IAllWalletAvatarImageNamesWithoutDividers =
  | IHdWalletAvatarImageNames
  | IHwWalletAvatarImageNames
  | IOthersWalletAvatarImageNames
  | IThirdPartyWalletAvatarImageNames;
export type IAllWalletAvatarImageNames =
  | 'cardDividers'
  | IAllWalletAvatarImageNamesWithoutDividers;

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

const TREZOR_MODEL_CODE_TO_AVATAR_KEY = new Map<
  string,
  IThirdPartyWalletAvatarImageNames
>([
  ['T1B1', 'TrezorModelOne'],
  ['T2T1', 'TrezorModelT'],
  ['T2B1', 'TrezorSafe3'],
  ['T3B1', 'TrezorSafe3'],
  ['T3T1', 'TrezorSafe5'],
  ['T3W1', 'TrezorSafe7'],
]);

// Fallback when vendorModel is unavailable; Ledger never needs this since its
// vendorModel is always the DMK code, never a human string.
const TREZOR_MODEL_NAME_ALIAS_TO_AVATAR_KEY = new Map<
  string,
  IThirdPartyWalletAvatarImageNames
>([
  ['model one', 'TrezorModelOne'],
  ['model t', 'TrezorModelT'],
  ['safe 3', 'TrezorSafe3'],
  ['safe 5', 'TrezorSafe5'],
  ['safe 7', 'TrezorSafe7'],
]);

const LEDGER_MODEL_CODE_TO_AVATAR_KEY = new Map<
  string,
  IThirdPartyWalletAvatarImageNames
>([
  ['nanoS', 'LedgerNanoS'],
  ['nanoSP', 'LedgerNanoS'],
  ['nanoX', 'LedgerNanoX'],
  ['stax', 'LedgerStax'],
  ['flex', 'LedgerFlex'],
  ['apexp', 'LedgerNanoGen5'],
]);

export function getThirdPartyDeviceAvatarImage({
  vendor,
  vendorModel,
  vendorModelName,
  fallback,
}: {
  vendor: EHardwareVendor;
  vendorModel?: string;
  vendorModelName?: string;
  fallback: IThirdPartyWalletAvatarImageNames;
}): IThirdPartyWalletAvatarImageNames {
  if (vendor === EHardwareVendor.trezor) {
    // Exact-case lookup — normalizing this branch stops 'T3W1' from matching.
    const byCode =
      vendorModel && TREZOR_MODEL_CODE_TO_AVATAR_KEY.get(vendorModel);
    if (byCode) return byCode;
    const normalizedName = thirdPartyDeviceUtils
      .normalizeThirdPartyModelName(vendorModelName)
      .replace(/^trezor /, '');
    const byName = TREZOR_MODEL_NAME_ALIAS_TO_AVATAR_KEY.get(normalizedName);
    if (byName) return byName;
    return fallback;
  }
  if (vendor === EHardwareVendor.ledger) {
    const byCode =
      vendorModel && LEDGER_MODEL_CODE_TO_AVATAR_KEY.get(vendorModel);
    if (byCode) return byCode;
    return fallback;
  }
  return fallback;
}
