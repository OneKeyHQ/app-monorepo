import { SimpleDbEntityNotificationSettings } from './SimpleDbEntityNotificationSettings';

import type { ISimpleDbNotificationSettings } from './SimpleDbEntityNotificationSettings';

let mockStored: ISimpleDbNotificationSettings = {};
jest.mock('../base/SimpleDbEntityBase', () => ({
  SimpleDbEntityBase: class {
    async getRawData() {
      return mockStored;
    }
    async setRawData(
      update: (
        data: ISimpleDbNotificationSettings,
      ) => ISimpleDbNotificationSettings,
    ) {
      mockStored = update(mockStored);
    }
  },
}));
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
}));

it('retains listing notification identities across entity recreation without changing account settings', async () => {
  mockStored = { accountActivity: { wallet: { enabled: true, accounts: {} } } };
  const token = {
    networkId: 'evm--1',
    tokenAddress: '0xdefault',
    symbol: 'AAPL',
    logoURI: '',
    isNative: false,
  };
  const entity = new SimpleDbEntityNotificationSettings();
  await entity.saveMarketListingTokens({ 'stock:AAPL': token });
  await expect(
    new SimpleDbEntityNotificationSettings().getMarketListingTokens(),
  ).resolves.toEqual({ 'stock:AAPL': token });
  expect(mockStored.accountActivity).toEqual({
    wallet: { enabled: true, accounts: {} },
  });
});
