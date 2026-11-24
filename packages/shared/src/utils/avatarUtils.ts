import { EDeviceType } from '@onekeyfe/hd-shared';

import { EHardwareVendor } from '../../types/device';

import {
  getNeoDeviceColor,
  getPro2DeviceColor,
  getPro2DeviceColorFromCode,
} from './hardwareDeviceColors';
import { NEO_DEVICE_TYPE } from './hardwareDeviceTypes';
import thirdPartyDeviceUtils from './thirdPartyDeviceUtils';

import type { INeoDeviceColor, IPro2DeviceColor } from './hardwareDeviceColors';
import type { IDeviceType, SearchDevice } from '@onekeyfe/hd-core';
import type { ImageSourcePropType } from 'react-native';

// Listed in picker order. Keys are stored on wallets and synced across
// devices: never rename or remove one. Builds without a key show the bear.
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
  hamster: require('../assets/wallet/avatar/Hamster.png'),
  mouse: require('../assets/wallet/avatar/Mouse.png'),
  horse: require('../assets/wallet/avatar/Horse.png'),
  unicorn: require('../assets/wallet/avatar/Unicorn.png'),
  dragon: require('../assets/wallet/avatar/Dragon.png'),
  owl: require('../assets/wallet/avatar/Owl.png'),
  penguin: require('../assets/wallet/avatar/Penguin.png'),
  chick: require('../assets/wallet/avatar/Chick.png'),
  parrot: require('../assets/wallet/avatar/Parrot.png'),
  peacock: require('../assets/wallet/avatar/Peacock.png'),
  octopus: require('../assets/wallet/avatar/Octopus.png'),
  whale: require('../assets/wallet/avatar/Whale.png'),
  jellyfish: require('../assets/wallet/avatar/Jellyfish.png'),
  crab: require('../assets/wallet/avatar/Crab.png'),
  tropicalFish: require('../assets/wallet/avatar/TropicalFish.png'),
  blowfish: require('../assets/wallet/avatar/Blowfish.png'),
  dinosaur: require('../assets/wallet/avatar/Dinosaur.png'),
  butterfly: require('../assets/wallet/avatar/Butterfly.png'),
  ladybug: require('../assets/wallet/avatar/Ladybug.png'),
  bee: require('../assets/wallet/avatar/Bee.png'),
};
export const HdWalletAvatarImageNames = Object.keys(
  HdWalletAvatarImages,
) as IHdWalletAvatarImageNames[];

/**
 * The device colors that ship with their own avatar art. The Pro's two
 * are told apart by serial here; the Pro 2's and the Neo's vocabulary
 * lives in ./hardwareDeviceColors, shared with the stage replicas.
 */
type IProColor = 'Black' | 'White';
type IPro2Color = IPro2DeviceColor;
type INeoColor = INeoDeviceColor;

export const HwWalletAvatarImages: Record<
  | IDeviceType
  | `${EDeviceType.Classic1s | EDeviceType.ClassicPure}Transparent`
  | `${EDeviceType.Pro}${IProColor}`
  | `${EDeviceType.Pro2}${IPro2Color}`
  | `${typeof NEO_DEVICE_TYPE}${INeoColor}`,
  ImageSourcePropType
> = {
  [EDeviceType.Unknown]: { uri: undefined },
  [EDeviceType.Classic]: require('../assets/wallet/avatar/Classic.png'),
  [EDeviceType.Classic1s]: require('../assets/wallet/avatar/Classic.png'),
  [EDeviceType.ClassicPure]: require('../assets/wallet/avatar/ClassicPure.png'),
  [`${EDeviceType.Classic1s}Transparent`]: require('../assets/wallet/avatar/Classic1sPureBTC.png'),
  [`${EDeviceType.ClassicPure}Transparent`]: require('../assets/wallet/avatar/Classic1sPureBTC.png'),
  [EDeviceType.Mini]: require('../assets/wallet/avatar/Mini.png'),
  [EDeviceType.Touch]: require('../assets/wallet/avatar/Touch.png'),
  [EDeviceType.Pro]: require('../assets/wallet/avatar/ProBlack.png'),
  // The bare model keys are each model's default finish — the Pro 2 in
  // black, the Neo in white — worn wherever neither a serial nor an
  // advertised color letter names a finish the model ships in, the same
  // defaults the stage replicas wear.
  [EDeviceType.Pro2]: require('../assets/wallet/avatar/Pro2Black.png'),
  [NEO_DEVICE_TYPE]: require('../assets/wallet/avatar/NeoWhite.png'),
  [`${EDeviceType.Pro}Black`]: require('../assets/wallet/avatar/ProBlack.png'),
  [`${EDeviceType.Pro}White`]: require('../assets/wallet/avatar/ProWhite.png'),
  [`${EDeviceType.Pro2}Black`]: require('../assets/wallet/avatar/Pro2Black.png'),
  [`${EDeviceType.Pro2}Orange`]: require('../assets/wallet/avatar/Pro2Orange.png'),
  [`${EDeviceType.Pro2}Silver`]: require('../assets/wallet/avatar/Pro2Silver.png'),
  [`${NEO_DEVICE_TYPE}Black`]: require('../assets/wallet/avatar/NeoBlack.png'),
  [`${NEO_DEVICE_TYPE}White`]: require('../assets/wallet/avatar/NeoWhite.png'),
  [`${NEO_DEVICE_TYPE}Green`]: require('../assets/wallet/avatar/NeoGreen.png'),
  [`${NEO_DEVICE_TYPE}Pink`]: require('../assets/wallet/avatar/NeoPink.png'),
};

export const OthersWalletAvatarImages = {
  othersExternal: require('../assets/wallet/avatar/others-external.png'),
  othersImported: require('../assets/wallet/avatar/others-imported.png'),
  othersWatching: require('../assets/wallet/avatar/others-watching.png'),
};

export const ThirdPartyWalletAvatarImages = {
  // Neutral vendor fallback for unrecognized/metadata-less devices — kept
  // distinct from any specific-model asset so an unknown device never
  // presents as a particular physical model.
  ledger: require('../assets/wallet/avatar/Ledger.png'),
  trezor: require('../assets/wallet/avatar/Trezor.png'),
  keystone: require('../assets/wallet/avatar/Keystone.png'),
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
  // The serial number's color letter as a Pro 2 advertises it over
  // Bluetooth before connecting (SDK `bleColorCode`).
  bleColorCode?: string,
): IHwWalletAvatarImageNames {
  if (
    (deviceType === EDeviceType.Classic1s ||
      deviceType === EDeviceType.ClassicPure) &&
    serialNo?.length === 11 &&
    serialNo.startsWith(deviceType === EDeviceType.Classic1s ? 'CL' : 'CP') &&
    serialNo.endsWith('C')
  ) {
    return `${deviceType}Transparent`;
  }
  if (deviceType === EDeviceType.Pro) {
    if (serialNo && serialNo?.startsWith('PR') && serialNo?.endsWith('B')) {
      return `${EDeviceType.Pro}White`;
    }
    return `${EDeviceType.Pro}Black`;
  }
  // A letter the model does not come in, and no serial at all, wear the
  // model's default finish (see the table above).
  if (deviceType === EDeviceType.Pro2) {
    const color =
      getPro2DeviceColor(serialNo) ?? getPro2DeviceColorFromCode(bleColorCode);
    return `${EDeviceType.Pro2}${color ?? 'Black'}`;
  }
  if (deviceType === NEO_DEVICE_TYPE) {
    return `${NEO_DEVICE_TYPE}${getNeoDeviceColor(serialNo) ?? 'White'}`;
  }
  return deviceType;
}

/** The avatar a scan result wears before the device connects. */
export function getSearchDeviceAvatarImage(
  device: Pick<SearchDevice, 'deviceType' | 'serialNo' | 'bleColorCode'>,
): IHwWalletAvatarImageNames {
  return getDeviceAvatarImage(
    device.deviceType,
    device.serialNo ?? undefined,
    device.bleColorCode,
  );
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
  // Legacy pre-internal_model firmware (Trezor One).
  ['1', 'TrezorModelOne'],
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
