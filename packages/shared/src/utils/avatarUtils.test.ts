import { readFileSync } from 'fs';
import { join } from 'path';

import { EDeviceType } from '@onekeyfe/hd-shared';

import { EHardwareVendor } from '../../types/device';

import {
  HwWalletAvatarImages,
  getThirdPartyDeviceAvatarImage,
} from './avatarUtils';
import { NEO_DEVICE_TYPE } from './hardwareDeviceTypes';

describe('HwWalletAvatarImages', () => {
  it.each([EDeviceType.Pro2, NEO_DEVICE_TYPE])(
    'uses the OneKey Pro artwork for %s',
    (deviceType) => {
      expect(HwWalletAvatarImages[deviceType]).toBe(
        HwWalletAvatarImages[EDeviceType.Pro],
      );
    },
  );
});

describe('ThirdPartyWalletAvatarImages neutral fallback', () => {
  // require() resolves to a single mocked value under Jest, so compare the
  // actual asset bytes on disk to prove the fallback keys are wired to their
  // own neutral artwork, not aliased onto a specific-model asset.
  const avatarDir = join(__dirname, '../assets/wallet/avatar');
  const readAvatar = (name: string) => readFileSync(join(avatarDir, name));

  it('keeps the vendor fallback assets distinct from any specific-model asset', () => {
    expect(readAvatar('Trezor.png').equals(readAvatar('TrezorSafe7.png'))).toBe(
      false,
    );
    expect(readAvatar('Ledger.png').equals(readAvatar('LedgerNanoX.png'))).toBe(
      false,
    );
  });
});

describe('getThirdPartyDeviceAvatarImage', () => {
  it.each([
    ['T1B1', 'TrezorModelOne'],
    ['T2T1', 'TrezorModelT'],
    ['T2B1', 'TrezorSafe3'],
    ['T3B1', 'TrezorSafe3'],
    ['T3T1', 'TrezorSafe5'],
    ['T3W1', 'TrezorSafe7'],
  ])('resolves Trezor model code %s to %s', (vendorModel, expected) => {
    expect(
      getThirdPartyDeviceAvatarImage({
        vendor: EHardwareVendor.trezor,
        vendorModel,
        fallback: 'trezor',
      }),
    ).toBe(expected);
  });

  it.each([
    ['Safe 3', 'TrezorSafe3'],
    ['safe 5', 'TrezorSafe5'],
    ['  Safe   7  ', 'TrezorSafe7'],
    ['Trezor Safe 7', 'TrezorSafe7'],
    ['Model One', 'TrezorModelOne'],
    ['Trezor Model T', 'TrezorModelT'],
  ])(
    'resolves Trezor vendorModelName alias "%s" to %s when vendorModel is unavailable',
    (vendorModelName, expected) => {
      expect(
        getThirdPartyDeviceAvatarImage({
          vendor: EHardwareVendor.trezor,
          vendorModelName,
          fallback: 'trezor',
        }),
      ).toBe(expected);
    },
  );

  it('prefers vendorModel code over vendorModelName alias', () => {
    expect(
      getThirdPartyDeviceAvatarImage({
        vendor: EHardwareVendor.trezor,
        vendorModel: 'T1B1',
        vendorModelName: 'Safe 7',
        fallback: 'trezor',
      }),
    ).toBe('TrezorModelOne');
  });

  it('does not match a Trezor code against the (lowercased) name-alias table', () => {
    // 'safe 7' only exists in the normalized name-alias table; the code
    // lookup must stay case-sensitive and must not fall through into it.
    expect(
      getThirdPartyDeviceAvatarImage({
        vendor: EHardwareVendor.trezor,
        vendorModel: 'safe 7',
        fallback: 'trezor',
      }),
    ).toBe('trezor');
  });

  it('falls back to the Trezor generic avatar for unknown model/name', () => {
    expect(
      getThirdPartyDeviceAvatarImage({
        vendor: EHardwareVendor.trezor,
        vendorModel: 'T9X9',
        vendorModelName: 'Unknown Model',
        fallback: 'trezor',
      }),
    ).toBe('trezor');
  });

  it.each([
    ['nanoS', 'LedgerNanoS'],
    ['nanoSP', 'LedgerNanoS'],
    ['nanoX', 'LedgerNanoX'],
    ['stax', 'LedgerStax'],
    ['flex', 'LedgerFlex'],
    ['apexp', 'LedgerNanoGen5'],
  ])('resolves Ledger model code %s to %s', (vendorModel, expected) => {
    expect(
      getThirdPartyDeviceAvatarImage({
        vendor: EHardwareVendor.ledger,
        vendorModel,
        fallback: 'ledger',
      }),
    ).toBe(expected);
  });

  it('falls back to the Ledger generic avatar for an unknown model code', () => {
    expect(
      getThirdPartyDeviceAvatarImage({
        vendor: EHardwareVendor.ledger,
        vendorModel: 'unknownModel',
        fallback: 'ledger',
      }),
    ).toBe('ledger');
  });

  it('always returns the fallback for a non-third-party vendor', () => {
    expect(
      getThirdPartyDeviceAvatarImage({
        vendor: EHardwareVendor.onekey,
        vendorModel: 'T3W1',
        vendorModelName: 'Safe 7',
        fallback: 'trezor',
      }),
    ).toBe('trezor');
  });
});
