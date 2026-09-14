import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  BOT_WALLET_STATUS_ACTIVE,
  BOT_WALLET_STATUS_DEACTIVATED,
} from '@onekeyhq/shared/src/consts/dbConsts';
import type { IBotWalletMetadataMap } from '@onekeyhq/shared/types/botWallet';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  WALLET_PROFILE_ANALYTICS_INTERVAL_MS,
  buildAnalyticsWalletProfile,
  computeHwVendorProfile,
  shouldReportAnalyticsWalletProfile,
} from './analyticsWalletProfile';

function createWallet({
  id,
  type = 'hd',
  isKeyless = false,
  vendor,
}: {
  id: string;
  type?: IDBWallet['type'];
  isKeyless?: boolean;
  vendor?: EHardwareVendor;
}): IDBWallet {
  return {
    id,
    name: id,
    type,
    isKeyless,
    backuped: true,
    accounts: [],
    nextIds: {},
    walletNo: 1,
    associatedDeviceInfo: vendor
      ? ({ vendor } as IDBWallet['associatedDeviceInfo'])
      : undefined,
  } as IDBWallet;
}

function createBotMetadata(
  entries: Array<[string, boolean]>,
): IBotWalletMetadataMap {
  return Object.fromEntries(
    entries.map(([walletId, visible], index) => [
      walletId,
      {
        index,
        name: walletId,
        visible,
        status: visible
          ? BOT_WALLET_STATUS_ACTIVE
          : BOT_WALLET_STATUS_DEACTIVATED,
        createdAt: 1,
      },
    ]),
  );
}

describe('buildAnalyticsWalletProfile', () => {
  it('returns no profile when there are no visible wallets', () => {
    expect(
      buildAnalyticsWalletProfile({
        wallets: [],
        botWalletMetadata: {},
      }),
    ).toBeUndefined();
  });

  it('aggregates the startup profile and excludes hidden bot wallets', () => {
    const visibleBotId = 'hd-bot--hd-keyless-parent-1--0';
    const hiddenBotId = 'hd-bot--hd-keyless-parent-1--1';
    const profile = buildAnalyticsWalletProfile({
      wallets: [
        createWallet({
          id: 'hd-keyless-parent-1',
          isKeyless: true,
        }),
        createWallet({ id: visibleBotId, isKeyless: true }),
        createWallet({ id: hiddenBotId, isKeyless: true }),
        createWallet({ id: 'imported-1', type: 'imported' }),
        createWallet({ id: 'hw-onekey', type: 'hw' }),
        createWallet({
          id: 'hw-ledger',
          type: 'hw',
          vendor: EHardwareVendor.ledger,
        }),
      ],
      botWalletMetadata: createBotMetadata([
        [visibleBotId, true],
        [hiddenBotId, false],
      ]),
    });

    expect(profile).toEqual({
      walletCount: 5,
      hwWalletCount: 2,
      appWalletCount: 3,
      keylessWalletCount: 1,
      hwVendors: ['ledger', 'onekey'],
      primaryHwVendor: 'ledger',
    });
  });

  it('keeps a visible orphan bot wallet in the keyless count', () => {
    const orphanBotId = 'hd-bot--missing-parent--0';

    expect(
      buildAnalyticsWalletProfile({
        wallets: [createWallet({ id: orphanBotId, isKeyless: true })],
        botWalletMetadata: createBotMetadata([[orphanBotId, true]]),
      }),
    ).toEqual({
      walletCount: 1,
      hwWalletCount: 0,
      appWalletCount: 1,
      keylessWalletCount: 1,
      hwVendors: [],
      primaryHwVendor: undefined,
    });
  });
});

describe('computeHwVendorProfile', () => {
  it('returns an empty vendor profile without hardware wallets', () => {
    expect(computeHwVendorProfile([createWallet({ id: 'hd-1' })])).toEqual({
      hwVendors: [],
      primaryHwVendor: undefined,
    });
  });

  it('falls back to OneKey for legacy hardware wallet records', () => {
    expect(
      computeHwVendorProfile([createWallet({ id: 'hw-legacy', type: 'hw' })]),
    ).toEqual({
      hwVendors: ['onekey'],
      primaryHwVendor: 'onekey',
    });
  });

  it('returns sorted vendors and selects the majority vendor', () => {
    const profile = computeHwVendorProfile([
      createWallet({ id: 'hw-legacy-1', type: 'hw' }),
      createWallet({ id: 'hw-legacy-2', type: 'hw' }),
      createWallet({
        id: 'hw-ledger',
        type: 'hw',
        vendor: EHardwareVendor.ledger,
      }),
    ]);

    expect(profile).toEqual({
      hwVendors: ['ledger', 'onekey'],
      primaryHwVendor: 'onekey',
    });
  });

  it('breaks equal vendor counts by lexical order', () => {
    const profile = computeHwVendorProfile([
      createWallet({ id: 'hw-onekey', type: 'hw' }),
      createWallet({
        id: 'hw-ledger',
        type: 'hw',
        vendor: EHardwareVendor.ledger,
      }),
    ]);

    expect(profile.primaryHwVendor).toBe('ledger');
  });
});

describe('shouldReportAnalyticsWalletProfile', () => {
  const now = 2 * WALLET_PROFILE_ANALYTICS_INTERVAL_MS;

  it('allows the first report', () => {
    expect(
      shouldReportAnalyticsWalletProfile({
        lastReportedAt: undefined,
        now,
      }),
    ).toBe(true);
  });

  it('limits reports to once per 24 hours', () => {
    expect(
      shouldReportAnalyticsWalletProfile({
        lastReportedAt: now - WALLET_PROFILE_ANALYTICS_INTERVAL_MS + 1,
        now,
      }),
    ).toBe(false);
    expect(
      shouldReportAnalyticsWalletProfile({
        lastReportedAt: now - WALLET_PROFILE_ANALYTICS_INTERVAL_MS,
        now,
      }),
    ).toBe(true);
  });
});
