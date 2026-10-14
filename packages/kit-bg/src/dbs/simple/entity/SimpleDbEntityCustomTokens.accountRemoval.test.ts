import appGlobals from '@onekeyhq/shared/src/appGlobals';

import { SimpleDbEntityCustomTokens } from './SimpleDbEntityCustomTokens';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundMethod:
    () => (_target: unknown, _key: unknown, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/appGlobals', () => ({
  __esModule: true,
  default: {
    $backgroundApiProxy: {
      serviceAccount: {
        getAccountXpubOrAddress: jest.fn(),
        getDBAccountSafe: jest.fn(),
        getIndexedAccountSafe: jest.fn(),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    accountSelector: {
      perf: {
        trace: jest.fn(),
      },
    },
  },
}));

type IServiceAccountMock = {
  getAccountXpubOrAddress: jest.Mock;
  getDBAccountSafe: jest.Mock;
  getIndexedAccountSafe: jest.Mock;
};

function getServiceAccountMock() {
  return appGlobals.$backgroundApiProxy
    .serviceAccount as unknown as IServiceAccountMock;
}

describe('SimpleDbEntityCustomTokens account-removal races', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(['getHiddenTokens', 'getCustomTokens'] as const)(
    '%s returns an empty list when the account is removed during identity lookup',
    async (methodName) => {
      const serviceAccount = getServiceAccountMock();
      serviceAccount.getAccountXpubOrAddress.mockRejectedValue(
        new Error('account not found'),
      );
      serviceAccount.getDBAccountSafe.mockResolvedValue(undefined);
      const entity = new SimpleDbEntityCustomTokens();

      await expect(
        entity[methodName]({
          accountId: 'account-1',
          networkId: 'evm--1',
        }),
      ).resolves.toEqual([]);

      expect(serviceAccount.getIndexedAccountSafe).not.toHaveBeenCalled();
    },
  );

  it.each(['getHiddenTokens', 'getCustomTokens'] as const)(
    '%s returns an empty list when the indexed account is removed during identity lookup',
    async (methodName) => {
      const serviceAccount = getServiceAccountMock();
      serviceAccount.getAccountXpubOrAddress.mockRejectedValue(
        new Error('indexed account not found'),
      );
      serviceAccount.getDBAccountSafe.mockResolvedValue({
        id: 'account-1',
        indexedAccountId: 'indexed-account-1',
      });
      serviceAccount.getIndexedAccountSafe.mockResolvedValue(undefined);
      const entity = new SimpleDbEntityCustomTokens();

      await expect(
        entity[methodName]({
          accountId: 'account-1',
          networkId: 'evm--1',
        }),
      ).resolves.toEqual([]);

      expect(serviceAccount.getIndexedAccountSafe).toHaveBeenCalledWith({
        id: 'indexed-account-1',
      });
    },
  );

  it.each(['getHiddenTokens', 'getCustomTokens'] as const)(
    '%s preserves real lookup failures while the account still exists',
    async (methodName) => {
      const lookupError = new Error('transport unavailable');
      const serviceAccount = getServiceAccountMock();
      serviceAccount.getAccountXpubOrAddress.mockRejectedValue(lookupError);
      serviceAccount.getDBAccountSafe.mockResolvedValue({
        id: 'account-1',
        indexedAccountId: 'indexed-account-1',
      });
      serviceAccount.getIndexedAccountSafe.mockResolvedValue({
        id: 'indexed-account-1',
      });
      const entity = new SimpleDbEntityCustomTokens();

      await expect(
        entity[methodName]({
          accountId: 'account-1',
          networkId: 'evm--1',
        }),
      ).rejects.toBe(lookupError);
    },
  );
});
