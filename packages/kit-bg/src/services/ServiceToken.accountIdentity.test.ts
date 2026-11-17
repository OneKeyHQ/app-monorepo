import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import ServiceToken from './ServiceToken';

const mockGetVault = jest.fn<Promise<never>, [unknown]>();
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
  checkDevOnlyPassword: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { MemoryPressureWarning: 'MemoryPressureWarning' },
  appEventBus: { on: jest.fn() },
}));
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getVault: (...args: [unknown]) => mockGetVault(...args) },
}));

describe('fetchTokensDetails account binding', () => {
  beforeEach(() => {
    mockGetVault
      .mockReset()
      .mockRejectedValue(new OneKeyLocalError('vault reached'));
  });

  it.each([
    { networkId: 'evm--1', actual: '0xAbC', expected: '0xabc', matches: true },
    { networkId: 'evm--1', actual: '0xAbC', expected: '0xdef', matches: false },
    { networkId: 'sol--101', actual: 'AbC', expected: 'abc', matches: false },
    { networkId: 'evm--1', actual: '', expected: '', matches: false },
  ])(
    'validates the resolved address before fetching: $networkId / $matches',
    async ({ networkId, actual, expected, matches }) => {
      const service = new ServiceToken({
        backgroundApi: {
          serviceAccount: {
            getAccountAddressForApi: async () => actual,
            getAccountXpub: async () => '',
          },
        },
      });
      await expect(
        service.fetchTokensDetails({
          accountId: 'account',
          networkId,
          contractList: ['token'],
          expectedAccountAddress: expected,
        }),
      ).rejects.toThrow(
        matches ? 'vault reached' : 'Token balance account changed',
      );
      expect(mockGetVault).toHaveBeenCalledTimes(matches ? 1 : 0);
    },
  );
});
