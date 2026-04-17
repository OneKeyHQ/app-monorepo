import {
  COINTYPE_LIGHTNING,
  COINTYPE_LIGHTNING_TESTNET,
} from '../engine/engineConsts';

import accountUtils from './accountUtils';

/*
yarn test packages/shared/src/utils/accountUtils.test.ts
*/

function testWithRandomAccountIndexes(
  testFunc: (accountIndex: number) => void,
) {
  for (let i = 0; i < 100; i += 1) {
    // Generate a random account index in the valid BIP44 range [0, 2147483647]
    const accountIndex = Math.floor(Math.random() * 2_147_483_648); // 2^31
    testFunc(accountIndex);
  }
}
describe('Lightning Path Transformation', () => {
  test('buildBtcToLnPath transforms mainnet path correctly', () => {
    testWithRandomAccountIndexes((accountIndex) => {
      const path = `m/84'/0'/${accountIndex}'`;
      const isTestnet = false;
      expect(accountUtils.buildBtcToLnPath({ path, isTestnet })).toBe(
        `m/44'/${COINTYPE_LIGHTNING}'/${accountIndex}'`,
      );
    });
  });

  test('buildBtcToLnPath transforms testnet path correctly', () => {
    testWithRandomAccountIndexes((accountIndex) => {
      const path = `m/84'/1'/${accountIndex}'`;
      const isTestnet = true;
      expect(accountUtils.buildBtcToLnPath({ path, isTestnet })).toBe(
        `m/44'/${COINTYPE_LIGHTNING_TESTNET}'/${accountIndex}'`,
      );
    });
  });

  test('buildLnToBtcPath transforms mainnet path back correctly', () => {
    testWithRandomAccountIndexes((accountIndex) => {
      const path = `m/44'/${COINTYPE_LIGHTNING}'/${accountIndex}'`;
      const isTestnet = false;
      expect(accountUtils.buildLnToBtcPath({ path, isTestnet })).toBe(
        `m/84'/0'/${accountIndex}'`,
      );
    });
  });

  test('buildLnToBtcPath transforms testnet path back correctly', () => {
    testWithRandomAccountIndexes((accountIndex) => {
      const path = `m/44'/${COINTYPE_LIGHTNING_TESTNET}'/${accountIndex}'`;
      const isTestnet = true;
      expect(accountUtils.buildLnToBtcPath({ path, isTestnet })).toBe(
        `m/84'/1'/${accountIndex}'`,
      );
    });
  });

  test('buildLightningAccountId transforms accountId correctly for mainnet', () => {
    testWithRandomAccountIndexes((accountIndex) => {
      const accountId = `hd-1--m/84'/0'/${accountIndex}'`;
      const isTestnet = false;
      expect(
        accountUtils.buildLightningAccountId({ accountId, isTestnet }),
      ).toBe(`hd-1--m/44'/${COINTYPE_LIGHTNING}'/${accountIndex}'`);
    });
  });

  test('buildLightningAccountId transforms accountId correctly for testnet', () => {
    testWithRandomAccountIndexes((accountIndex) => {
      const accountId = `hd-1--m/84'/1'/${accountIndex}'`;
      const isTestnet = true;
      expect(
        accountUtils.buildLightningAccountId({ accountId, isTestnet }),
      ).toBe(`hd-1--m/44'/${COINTYPE_LIGHTNING_TESTNET}'/${accountIndex}'`);
    });
  });

  test('buildLightningAccountId throws error on invalid accountId format', () => {
    const accountId = 'invalidFormat';
    const isTestnet = false;
    expect(() =>
      accountUtils.buildLightningAccountId({ accountId, isTestnet }),
    ).toThrow('buildLightningAccountId ERROR: invalid accountId');
  });
});

describe('Bot Wallet ID Parsing', () => {
  test('builds hd wallet hash with the shared mnemonic salt algorithm', () => {
    expect(
      accountUtils.buildHdWalletHash({
        mnemonic: 'test test test test test test test test test test test junk',
      }),
    ).toBe('7038aa6c08d7f30cd0f0aa1214e728da6c4aa2dbffe51fab738be48b7776f034');
  });

  test('parses bot indexedAccountId without truncating walletId', () => {
    const botWalletId = accountUtils.buildBotWalletId({
      parentKeylessWalletId: 'hd-keyless-test-parent',
      index: 3,
    });
    const indexedAccountId = accountUtils.buildIndexedAccountId({
      walletId: botWalletId,
      index: 7,
    });

    expect(accountUtils.parseIndexedAccountId({ indexedAccountId })).toEqual({
      walletId: botWalletId,
      index: 7,
    });
  });

  test('parses bot indexedAccountId when parent keyless wallet id contains separators', () => {
    const botWalletId = accountUtils.buildBotWalletId({
      parentKeylessWalletId: 'hd-keyless--test-parent',
      index: 3,
    });
    const indexedAccountId = accountUtils.buildIndexedAccountId({
      walletId: botWalletId,
      index: 7,
    });

    expect(
      accountUtils.getWalletIdFromAccountId({ accountId: indexedAccountId }),
    ).toBe(botWalletId);
    expect(accountUtils.parseIndexedAccountId({ indexedAccountId })).toEqual({
      walletId: botWalletId,
      index: 7,
    });
  });

  test('parses bot accountId without truncating walletId', () => {
    const botWalletId = accountUtils.buildBotWalletId({
      parentKeylessWalletId: 'hd-keyless-test-parent',
      index: 1,
    });
    const accountId = accountUtils.buildHDAccountId({
      walletId: botWalletId,
      path: `m/44'/60'/0'/0/0`,
    });

    expect(accountUtils.getWalletIdFromAccountId({ accountId })).toBe(
      botWalletId,
    );
    expect(accountUtils.parseAccountId({ accountId })).toEqual({
      walletId: botWalletId,
      usedPath: `m/44'/60'/0'/0/0`,
      idSuffix: undefined,
    });
  });

  test('preserves bot accountId suffix when parsing', () => {
    const botWalletId = accountUtils.buildBotWalletId({
      parentKeylessWalletId: 'hd-keyless-test-parent',
      index: 2,
    });
    const accountId = accountUtils.buildHDAccountId({
      walletId: botWalletId,
      path: `m/44'/60'/0'/0/0`,
      idSuffix: 'LedgerLive',
    });

    expect(accountUtils.parseAccountId({ accountId })).toEqual({
      walletId: botWalletId,
      usedPath: `m/44'/60'/0'/0/0`,
      idSuffix: 'LedgerLive',
    });
  });

  test('preserves bot account parsing when parent keyless wallet id contains separators', () => {
    const botWalletId = accountUtils.buildBotWalletId({
      parentKeylessWalletId: 'hd-keyless--test-parent',
      index: 2,
    });
    const accountId = accountUtils.buildHDAccountId({
      walletId: botWalletId,
      path: `m/44'/60'/0'/0/0`,
      idSuffix: 'LedgerLive',
    });

    expect(accountUtils.getWalletIdFromAccountId({ accountId })).toBe(
      botWalletId,
    );
    expect(accountUtils.parseAccountId({ accountId })).toEqual({
      walletId: botWalletId,
      usedPath: `m/44'/60'/0'/0/0`,
      idSuffix: 'LedgerLive',
    });
  });

  test('rejects bot wallet ids with non-digit suffixes', () => {
    expect(accountUtils.parseBotWalletId('hd-bot--hd-keyless-parent--1x')).toBe(
      undefined,
    );
    expect(accountUtils.parseBotWalletId('hd-bot--hd-keyless-parent--+1')).toBe(
      undefined,
    );
  });
});
