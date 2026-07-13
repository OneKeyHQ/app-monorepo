import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { BOT_WALLET_STATUS_DEACTIVATED } from '@onekeyhq/shared/src/consts/dbConsts';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  buildGroupedAccountSelectorWallets,
  computeHwVendorProfile,
  getWalletChildrenLength,
} from './walletListUtils';

function createWallet({
  id,
  name,
  isKeyless = false,
  type = 'hd',
}: {
  id: string;
  name: string;
  isKeyless?: boolean;
  type?: IDBWallet['type'];
}): IDBWallet {
  return {
    id,
    name,
    type,
    isKeyless,
    backuped: true,
    accounts: [],
    nextIds: {},
    walletNo: 1,
  } as IDBWallet;
}

describe('walletListUtils', () => {
  it('groups bot wallets under their parent keyless wallet', () => {
    const wallets = buildGroupedAccountSelectorWallets([
      {
        wallet: createWallet({
          id: 'hd-keyless-parent-1',
          name: 'Parent',
          isKeyless: true,
        }),
        isBotWallet: false,
        isBotDeactivated: false,
      },
      {
        wallet: createWallet({
          id: 'hd-bot--hd-keyless-parent-1--0',
          name: 'Bot #1',
        }),
        isBotWallet: true,
        isBotDeactivated: false,
      },
      {
        wallet: createWallet({
          id: 'hd-2',
          name: 'Wallet 2',
        }),
        isBotWallet: false,
        isBotDeactivated: false,
      },
    ]);

    expect(wallets).toHaveLength(2);
    expect(wallets[0].id).toBe('hd-keyless-parent-1');
    expect(wallets[0].botWallets?.map((wallet) => wallet.id)).toEqual([
      'hd-bot--hd-keyless-parent-1--0',
    ]);
    expect(wallets[1].id).toBe('hd-2');
  });

  it('attaches bot wallets even when they appear before their parent', () => {
    const wallets = buildGroupedAccountSelectorWallets([
      {
        wallet: createWallet({
          id: 'hd-bot--hd-keyless-parent-1--1',
          name: 'Bot #2',
        }),
        isBotWallet: true,
        isBotDeactivated: false,
      },
      {
        wallet: createWallet({
          id: 'hd-bot--hd-keyless-parent-1--0',
          name: 'Bot #1',
        }),
        isBotWallet: true,
        isBotDeactivated: false,
      },
      {
        wallet: createWallet({
          id: 'hd-keyless-parent-1',
          name: 'Parent',
          isKeyless: true,
        }),
        isBotWallet: false,
        isBotDeactivated: false,
      },
    ]);

    expect(wallets).toHaveLength(1);
    expect(wallets[0].id).toBe('hd-keyless-parent-1');
    expect(wallets[0].botWallets?.map((wallet) => wallet.id)).toEqual([
      'hd-bot--hd-keyless-parent-1--0',
      'hd-bot--hd-keyless-parent-1--1',
    ]);
  });

  it('keeps bot wallets at top level when the parent wallet is missing', () => {
    const wallets = buildGroupedAccountSelectorWallets([
      {
        wallet: createWallet({
          id: 'hd-bot--hd-keyless-parent-1--0',
          name: 'Bot #1',
        }),
        isBotWallet: true,
        isBotDeactivated: true,
      },
    ]);

    expect(wallets).toHaveLength(1);
    expect(wallets[0].id).toBe('hd-bot--hd-keyless-parent-1--0');
    expect(wallets[0].botStatus).toBe(BOT_WALLET_STATUS_DEACTIVATED);
  });

  it('counts hidden and bot wallets together', () => {
    expect(
      getWalletChildrenLength({
        hiddenWallets: [createWallet({ id: 'hidden-1', name: 'Hidden' })],
        botWallets: [
          {
            ...createWallet({
              id: 'hd-bot--hd-keyless-parent-1--0',
              name: 'Bot #1',
            }),
          },
          {
            ...createWallet({
              id: 'hd-bot--hd-keyless-parent-1--1',
              name: 'Bot #2',
            }),
          },
        ],
      }),
    ).toBe(3);
  });
});

function createHwWallet({
  id,
  vendor,
}: {
  id: string;
  vendor?: EHardwareVendor;
}): IDBWallet {
  return {
    id,
    name: id,
    type: 'hw',
    backuped: true,
    accounts: [],
    nextIds: {},
    walletNo: 1,
    associatedDeviceInfo: vendor ? ({ vendor } as any) : undefined,
  } as IDBWallet;
}

describe('computeHwVendorProfile', () => {
  it('returns empty profile when there are no hardware wallets', () => {
    expect(
      computeHwVendorProfile([
        { id: 'hd-1', name: 'HD', type: 'hd' } as IDBWallet,
      ]),
    ).toEqual({ hwVendors: [], primaryHwVendor: undefined });
  });

  it('ignores non-hw wallets when aggregating vendors', () => {
    // hd + keyless + imported wallets must not appear in vendor stats
    const result = computeHwVendorProfile([
      { id: 'hd-1', type: 'hd' } as IDBWallet,
      { id: 'imported-1', type: 'imported' } as IDBWallet,
      createHwWallet({ id: 'hw-1', vendor: EHardwareVendor.onekey }),
    ]);
    expect(result).toEqual({
      hwVendors: ['onekey'],
      primaryHwVendor: 'onekey',
    });
  });

  it('falls back to onekey for hw wallets with no vendor on device record', () => {
    // Legacy hw wallets created before vendor was persisted should still be
    // counted as OneKey, otherwise existing OneKey users would show up as
    // having zero hw vendors on a fresh app launch.
    expect(
      computeHwVendorProfile([createHwWallet({ id: 'hw-legacy' })]),
    ).toEqual({
      hwVendors: ['onekey'],
      primaryHwVendor: 'onekey',
    });
  });

  it('reports ledger when a single Ledger wallet is present', () => {
    expect(
      computeHwVendorProfile([
        createHwWallet({ id: 'hw-ledger', vendor: EHardwareVendor.ledger }),
      ]),
    ).toEqual({
      hwVendors: ['ledger'],
      primaryHwVendor: 'ledger',
    });
  });

  it('returns sorted unique vendor list and picks majority as primary', () => {
    // Two OneKey wallets vs one Ledger — primary should be OneKey.
    // hwVendors is sorted lexically so consumers get stable ordering.
    const result = computeHwVendorProfile([
      createHwWallet({ id: 'hw-1', vendor: EHardwareVendor.onekey }),
      createHwWallet({ id: 'hw-2', vendor: EHardwareVendor.onekey }),
      createHwWallet({ id: 'hw-3', vendor: EHardwareVendor.ledger }),
    ]);
    expect(result.hwVendors).toEqual(['ledger', 'onekey']);
    expect(result.primaryHwVendor).toBe('onekey');
  });

  it('breaks vendor-count ties deterministically by lexical order', () => {
    // 1 OneKey + 1 Ledger — both have count=1.
    // The reducer scans sorted vendor keys ['ledger', 'onekey'] and only
    // replaces the leader on strict-greater, so the first key ('ledger') wins.
    // Document this so consumers don't depend on a different tiebreak.
    const result = computeHwVendorProfile([
      createHwWallet({ id: 'hw-1', vendor: EHardwareVendor.onekey }),
      createHwWallet({ id: 'hw-2', vendor: EHardwareVendor.ledger }),
    ]);
    expect(result.hwVendors).toEqual(['ledger', 'onekey']);
    expect(result.primaryHwVendor).toBe('ledger');
  });

  it('handles mixed legacy (no vendor) + Ledger as onekey + ledger', () => {
    // Realistic 6.3.0 upgrade scenario: existing OneKey user (legacy device
    // record without vendor field) adds a Ledger wallet. Profile must show
    // both vendors and pick majority.
    const result = computeHwVendorProfile([
      createHwWallet({ id: 'hw-onekey-legacy' }),
      createHwWallet({ id: 'hw-onekey-legacy-2' }),
      createHwWallet({ id: 'hw-ledger', vendor: EHardwareVendor.ledger }),
    ]);
    expect(result.hwVendors).toEqual(['ledger', 'onekey']);
    expect(result.primaryHwVendor).toBe('onekey');
  });
});
