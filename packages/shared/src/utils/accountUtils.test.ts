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

describe('Hidden Wallet Helpers', () => {
  test('isHdHiddenWallet returns true for HD wallet with passphraseState', () => {
    const wallet = {
      id: 'hd-1',
      passphraseState: 'abcd1234',
    } as unknown as NonNullable<
      Parameters<typeof accountUtils.isHdHiddenWallet>[0]['wallet']
    >;
    expect(accountUtils.isHdHiddenWallet({ wallet })).toBe(true);
  });

  test('isHdHiddenWallet returns false for HD wallet without passphraseState', () => {
    const wallet = {
      id: 'hd-1',
      passphraseState: '',
    } as unknown as NonNullable<
      Parameters<typeof accountUtils.isHdHiddenWallet>[0]['wallet']
    >;
    expect(accountUtils.isHdHiddenWallet({ wallet })).toBe(false);
  });

  test('isHiddenWallet returns true for HW hidden wallet', () => {
    const wallet = {
      id: 'hw-1',
      passphraseState: 'abcd1234',
    } as unknown as NonNullable<
      Parameters<typeof accountUtils.isHiddenWallet>[0]['wallet']
    >;
    expect(accountUtils.isHiddenWallet({ wallet })).toBe(true);
  });

  test('isHiddenWallet returns true for QR hidden wallet', () => {
    const wallet = {
      id: 'qr-1',
      passphraseState: 'abcd1234',
    } as unknown as NonNullable<
      Parameters<typeof accountUtils.isHiddenWallet>[0]['wallet']
    >;
    expect(accountUtils.isHiddenWallet({ wallet })).toBe(true);
  });

  test('isHiddenWallet returns true for HD hidden wallet', () => {
    const wallet = {
      id: 'hd-1',
      passphraseState: 'abcd1234',
    } as unknown as NonNullable<
      Parameters<typeof accountUtils.isHiddenWallet>[0]['wallet']
    >;
    expect(accountUtils.isHiddenWallet({ wallet })).toBe(true);
  });

  test('isHdHiddenWallet returns false for non-HD wallet even with passphraseState', () => {
    const wallet = {
      id: 'hw-1',
      passphraseState: 'abcd1234',
    } as unknown as NonNullable<
      Parameters<typeof accountUtils.isHdHiddenWallet>[0]['wallet']
    >;
    expect(accountUtils.isHdHiddenWallet({ wallet })).toBe(false);
  });

  test('isHiddenWallet returns false for standard HD wallet', () => {
    const wallet = {
      id: 'hd-1',
    } as unknown as NonNullable<
      Parameters<typeof accountUtils.isHiddenWallet>[0]['wallet']
    >;
    expect(accountUtils.isHiddenWallet({ wallet })).toBe(false);
  });

  test('isHiddenWallet returns false for standard HW wallet', () => {
    const wallet = {
      id: 'hw-1',
      passphraseState: '',
    } as unknown as NonNullable<
      Parameters<typeof accountUtils.isHiddenWallet>[0]['wallet']
    >;
    expect(accountUtils.isHiddenWallet({ wallet })).toBe(false);
  });
});
