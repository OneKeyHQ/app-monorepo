import { BOT_WALLET_STATUS_ACTIVE } from '@onekeyhq/shared/src/consts/dbConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import {
  filterBotWalletRecordsByCurrentKeylessSyncScope,
  isBotWalletInCurrentKeylessSyncScope,
} from './botWalletCloudSyncUtils';

describe('botWalletCloudSyncUtils', () => {
  const walletIdA0 = accountUtils.buildBotWalletId({
    parentKeylessWalletId: 'hd-keyless-a',
    index: 0,
  });
  const walletIdA1 = accountUtils.buildBotWalletId({
    parentKeylessWalletId: 'hd-keyless-a',
    index: 1,
  });
  const walletIdB0 = accountUtils.buildBotWalletId({
    parentKeylessWalletId: 'hd-keyless-b',
    index: 0,
  });

  test('isBotWalletInCurrentKeylessSyncScope only matches current parent keyless wallet', () => {
    expect(
      isBotWalletInCurrentKeylessSyncScope({
        walletId: walletIdA0,
        currentKeylessWalletId: 'hd-keyless-a',
      }),
    ).toBe(true);

    expect(
      isBotWalletInCurrentKeylessSyncScope({
        walletId: walletIdA0,
        currentKeylessWalletId: 'hd-keyless-b',
      }),
    ).toBe(false);

    expect(
      isBotWalletInCurrentKeylessSyncScope({
        walletId: 'hd-1',
        currentKeylessWalletId: 'hd-keyless-a',
      }),
    ).toBe(false);
  });

  test('filterBotWalletRecordsByCurrentKeylessSyncScope removes bot wallets from other keyless domains', () => {
    const records = [
      {
        walletId: walletIdA0,
        metadata: {
          index: 0,
          name: 'A0',
          visible: true,
          status: BOT_WALLET_STATUS_ACTIVE,
          createdAt: 1,
        },
      },
      {
        walletId: walletIdA1,
        metadata: {
          index: 1,
          name: 'A1',
          visible: true,
          status: BOT_WALLET_STATUS_ACTIVE,
          createdAt: 2,
        },
      },
      {
        walletId: walletIdB0,
        metadata: {
          index: 0,
          name: 'B0',
          visible: true,
          status: BOT_WALLET_STATUS_ACTIVE,
          createdAt: 3,
        },
      },
    ] as const;

    expect(
      filterBotWalletRecordsByCurrentKeylessSyncScope({
        records: records as any,
        currentKeylessWalletId: 'hd-keyless-a',
      }).map((record) => record.walletId),
    ).toEqual([walletIdA0, walletIdA1]);

    expect(
      filterBotWalletRecordsByCurrentKeylessSyncScope({
        records: records as any,
        currentKeylessWalletId: 'hd-keyless-b',
      }).map((record) => record.walletId),
    ).toEqual([walletIdB0]);
  });
});
