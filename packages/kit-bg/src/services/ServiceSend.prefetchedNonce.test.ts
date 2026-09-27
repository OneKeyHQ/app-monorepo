jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => (fn: () => unknown) => fn(),
}));
jest.mock('p-retry', () => ({
  __esModule: true,
  default: (fn: () => unknown) => fn(),
}));
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
  toastIfError: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) => d,
}));
jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getVault: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: { formatMessage: ({ id }: { id: string }) => id },
    onLocaleChange: () => undefined,
  },
}));

// eslint-disable-next-line import-js/order, import/first
import ServiceSend from './ServiceSend';

const accountId = 'hd-1--0';
const networkId = 'evm--1';
const accountAddress = '0xabc';

function makeService() {
  const fetchAccountDetails = jest.fn().mockResolvedValue({ nonce: 8 });
  const getMaxPendingNonce = jest.fn().mockResolvedValue(6);
  const getPendingNonceList = jest.fn().mockResolvedValue([5, 6]);
  const Ctor = ServiceSend as unknown as new (args: {
    backgroundApi: unknown;
  }) => ServiceSend;
  const service = new Ctor({
    backgroundApi: {
      serviceAccountProfile: { fetchAccountDetails },
      simpleDb: {
        localHistory: { getMaxPendingNonce, getPendingNonceList },
      },
    },
  });
  return { service, fetchAccountDetails, getMaxPendingNonce };
}

describe('ServiceSend.getNextNonce prefetched on-chain nonce', () => {
  it('uses a fresh matching chain nonce and rechecks local pending transactions', async () => {
    const { service, fetchAccountDetails, getMaxPendingNonce } = makeService();
    await expect(
      service.getNextNonce({
        accountId,
        networkId,
        accountAddress,
        prefetchedOnChainNonce: {
          nonce: 5,
          fetchedAt: Date.now(),
          accountId,
          networkId,
          accountAddress: '0xABC',
        },
      }),
    ).resolves.toBe(7);
    expect(fetchAccountDetails).not.toHaveBeenCalled();
    expect(getMaxPendingNonce).toHaveBeenCalledWith({
      accountAddress,
      networkId,
    });
  });

  it('refetches when the prefetched nonce is stale or belongs to another account', async () => {
    const { service, fetchAccountDetails } = makeService();
    await expect(
      service.getNextNonce({
        accountId,
        networkId,
        accountAddress,
        prefetchedOnChainNonce: {
          nonce: 5,
          fetchedAt: Date.now() - 3000,
          accountId,
          networkId,
          accountAddress,
        },
      }),
    ).resolves.toBe(8);
    await expect(
      service.getNextNonce({
        accountId,
        networkId,
        accountAddress,
        prefetchedOnChainNonce: {
          nonce: 5,
          fetchedAt: Date.now(),
          accountId: 'hd-other--0',
          networkId,
          accountAddress,
        },
      }),
    ).resolves.toBe(8);
    expect(fetchAccountDetails).toHaveBeenCalledTimes(2);
  });
});
