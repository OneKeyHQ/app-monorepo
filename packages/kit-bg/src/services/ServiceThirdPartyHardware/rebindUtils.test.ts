import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { pickThirdPartyRebindDevice } from './rebindUtils';

import type { IDBDevice, IDBWallet } from '../../dbs/local/types';

function buildWallet(overrides: Partial<IDBWallet>): IDBWallet {
  return {
    id: 'hw-wallet-default',
    walletNo: 1,
    associatedDevice: 'device-default',
    ...overrides,
  } as IDBWallet;
}

function buildDevice(overrides: Partial<IDBDevice>): IDBDevice {
  return {
    id: 'device-default',
    vendor: EHardwareVendor.trezor,
    ...overrides,
  } as IDBDevice;
}

describe('pickThirdPartyRebindDevice', () => {
  it('picks the device when vendor and model both match', () => {
    const device = buildDevice({
      id: 'device-1',
      settings: { vendorModel: 'T3W1' } as IDBDevice['settings'],
    });
    const wallet = buildWallet({ id: 'hw-1', associatedDevice: 'device-1' });

    expect(
      pickThirdPartyRebindDevice({
        walletsWithXfp: [wallet],
        devices: [device],
        vendor: EHardwareVendor.trezor,
        vendorModel: 'T3W1',
      }),
    ).toBe(device);
  });

  it('does not pick the device when both sides have a model and they differ', () => {
    // Safe 5 vs Safe 3 style collision: same XFP (seed), different physical
    // hardware — the exact case the model guard exists to catch.
    const device = buildDevice({
      id: 'device-1',
      settings: { vendorModel: 'T2B1' } as IDBDevice['settings'],
    });
    const wallet = buildWallet({ id: 'hw-1', associatedDevice: 'device-1' });

    expect(
      pickThirdPartyRebindDevice({
        walletsWithXfp: [wallet],
        devices: [device],
        vendor: EHardwareVendor.trezor,
        vendorModel: 'T3W1',
      }),
    ).toBeUndefined();
  });

  it('matches case-insensitively when both sides carry the internal code', () => {
    const device = buildDevice({
      id: 'device-1',
      settings: { vendorModel: 't3w1' } as IDBDevice['settings'],
    });
    const wallet = buildWallet({ id: 'hw-1', associatedDevice: 'device-1' });

    expect(
      pickThirdPartyRebindDevice({
        walletsWithXfp: [wallet],
        devices: [device],
        vendor: EHardwareVendor.trezor,
        vendorModel: 'T3W1',
      }),
    ).toBe(device);
  });

  it('does not block when the stored model is a display name (not comparable to the internal code)', () => {
    // Some writers persist device.model ('Trezor Safe 7') instead of the
    // internal code; that must never veto the same physical device.
    const device = buildDevice({
      id: 'device-1',
      settings: { vendorModel: 'Trezor Safe 7' } as IDBDevice['settings'],
    });
    const wallet = buildWallet({ id: 'hw-1', associatedDevice: 'device-1' });

    expect(
      pickThirdPartyRebindDevice({
        walletsWithXfp: [wallet],
        devices: [device],
        vendor: EHardwareVendor.trezor,
        vendorModel: 'T3W1',
      }),
    ).toBe(device);
  });

  it('does not block the match when the stored device has no model on record', () => {
    const device = buildDevice({ id: 'device-1' });
    const wallet = buildWallet({ id: 'hw-1', associatedDevice: 'device-1' });

    expect(
      pickThirdPartyRebindDevice({
        walletsWithXfp: [wallet],
        devices: [device],
        vendor: EHardwareVendor.trezor,
        vendorModel: 'T3W1',
      }),
    ).toBe(device);
  });

  it('does not block the match when the incoming device has no model to compare', () => {
    const device = buildDevice({
      id: 'device-1',
      settings: { vendorModel: 'T3W1' } as IDBDevice['settings'],
    });
    const wallet = buildWallet({ id: 'hw-1', associatedDevice: 'device-1' });

    expect(
      pickThirdPartyRebindDevice({
        walletsWithXfp: [wallet],
        devices: [device],
        vendor: EHardwareVendor.trezor,
        vendorModel: undefined,
      }),
    ).toBe(device);
  });

  it('never matches across vendors even on an XFP collision', () => {
    const device = buildDevice({
      id: 'device-1',
      vendor: EHardwareVendor.ledger,
      settings: { vendorModel: 'T3W1' } as IDBDevice['settings'],
    });
    const wallet = buildWallet({ id: 'hw-1', associatedDevice: 'device-1' });

    expect(
      pickThirdPartyRebindDevice({
        walletsWithXfp: [wallet],
        devices: [device],
        vendor: EHardwareVendor.trezor,
        vendorModel: 'T3W1',
      }),
    ).toBeUndefined();
  });

  it('excludes hidden (passphrase) wallets from rebind candidates', () => {
    const device = buildDevice({ id: 'device-1' });
    const hiddenWallet = buildWallet({
      id: 'hw-1',
      associatedDevice: 'device-1',
      passphraseState: 'some-state',
    });

    expect(
      pickThirdPartyRebindDevice({
        walletsWithXfp: [hiddenWallet],
        devices: [device],
        vendor: EHardwareVendor.trezor,
        vendorModel: 'T3W1',
      }),
    ).toBeUndefined();
  });

  it('prefers the most recently created wallet when several match', () => {
    const deviceOld = buildDevice({ id: 'device-old' });
    const deviceNew = buildDevice({ id: 'device-new' });
    const walletOld = buildWallet({
      id: 'hw-old',
      walletNo: 1,
      associatedDevice: 'device-old',
    });
    const walletNew = buildWallet({
      id: 'hw-new',
      walletNo: 2,
      associatedDevice: 'device-new',
    });

    expect(
      pickThirdPartyRebindDevice({
        walletsWithXfp: [walletOld, walletNew],
        devices: [deviceOld, deviceNew],
        vendor: EHardwareVendor.trezor,
        vendorModel: 'T3W1',
      }),
    ).toBe(deviceNew);
  });

  it('skips a wallet whose associated device row no longer exists', () => {
    const wallet = buildWallet({
      id: 'hw-1',
      associatedDevice: 'device-missing',
    });

    expect(
      pickThirdPartyRebindDevice({
        walletsWithXfp: [wallet],
        devices: [],
        vendor: EHardwareVendor.trezor,
        vendorModel: 'T3W1',
      }),
    ).toBeUndefined();
  });
});
