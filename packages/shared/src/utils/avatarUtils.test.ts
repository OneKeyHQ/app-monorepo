import { readFileSync } from 'fs';
import { join } from 'path';

import { EDeviceType } from '@onekeyfe/hd-shared';

import { EHardwareVendor } from '../../types/device';

import {
  getDeviceAvatarImage,
  getThirdPartyDeviceAvatarImage,
} from './avatarUtils';

// require() resolves to a single mocked value under Jest, so tests that must
// tell artworks apart compare the actual asset bytes on disk.
const avatarDir = join(__dirname, '../assets/wallet/avatar');
const readAvatar = (name: string) => readFileSync(join(avatarDir, name));

describe('HwWalletAvatarImages', () => {
  it.each([
    ['Pro2Black.png', 'ProBlack.png'],
    ['Pro2Silver.png', 'Pro2Black.png'],
    ['Pro2Orange.png', 'Pro2Black.png'],
  ])('gives %s its own artwork rather than %s', (name, other) => {
    expect(readAvatar(name).equals(readAvatar(other))).toBe(false);
  });

  // Every require() is the same stub under Jest, so the table's wiring is
  // read off the source: each key must name its own file, or a key aliased
  // onto a sibling's art (the Pro 2 on the Pro's, Silver on Orange's) would
  // pass every runtime assertion.
  const source = readFileSync(join(__dirname, 'avatarUtils.ts'), 'utf8');
  const requiredFileOf = (key: string): string | undefined => {
    const prefix = `[${key}]: require('../assets/wallet/avatar/`;
    const start = source.indexOf(prefix);
    if (start < 0) {
      return undefined;
    }
    const from = start + prefix.length;
    return source.slice(from, source.indexOf("'", from));
  };
  /** A per-color key as the table spells it: `${EDeviceType.<model>}<Color>`. */
  const colorKey = (model: 'Pro' | 'Pro2', color: string) =>
    `\`\${EDeviceType.${model}}${color}\``;
  it.each([
    ['EDeviceType.Pro2', 'Pro2Black.png'],
    [colorKey('Pro2', 'Black'), 'Pro2Black.png'],
    [colorKey('Pro2', 'Silver'), 'Pro2Silver.png'],
    [colorKey('Pro2', 'Orange'), 'Pro2Orange.png'],
    [colorKey('Pro', 'Black'), 'ProBlack.png'],
    [colorKey('Pro', 'White'), 'ProWhite.png'],
  ])('wires %s to %s', (key, file) => {
    expect(requiredFileOf(key)).toBe(file);
  });
});

describe('getDeviceAvatarImage', () => {
  it.each([
    ['PR0001B', 'proWhite'],
    ['PR0001A', 'proBlack'],
    [undefined, 'proBlack'],
  ])('resolves a Pro serial %s to %s', (serialNo, expected) => {
    expect(getDeviceAvatarImage(EDeviceType.Pro, serialNo)).toBe(expected);
  });

  it.each([
    ['P20001A', 'pro2Black'],
    ['P20001B', 'pro2Silver'],
    ['P20001D', 'pro2Orange'],
    // Letters the Pro 2 does not come in, and no serial, wear black.
    ['P20001C', 'pro2Black'],
    ['P20001E', 'pro2Black'],
    ['P20001Z', 'pro2Black'],
    [undefined, 'pro2Black'],
  ])('resolves a Pro 2 serial %s to %s', (serialNo, expected) => {
    expect(getDeviceAvatarImage(EDeviceType.Pro2, serialNo)).toBe(expected);
  });

  it('returns the model itself for models without color variants', () => {
    expect(getDeviceAvatarImage(EDeviceType.Touch, 'TC0001A')).toBe(
      EDeviceType.Touch,
    );
  });
});

describe('ThirdPartyWalletAvatarImages neutral fallback', () => {
  // The fallback keys are wired to their own neutral artwork, not aliased
  // onto a specific-model asset.
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
    ['1', 'TrezorModelOne'],
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
