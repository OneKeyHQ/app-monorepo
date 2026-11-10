/* eslint-disable import/first */

const mockChangeUser = jest.fn<Promise<void>, [string]>();
const mockGenerateAnonymousAppUserId = jest.fn(() => 'anonymous-user');
const mockGetAppUserId = jest.fn(() => 'onekey-user');
const mockIsConfigured = jest.fn(() => true);
const mockGetSharedInstance = jest.fn(() => ({
  changeUser: mockChangeUser,
  getAppUserId: mockGetAppUserId,
}));
const mockIsPurchasesSdkWebLoaded = jest.fn(() => true);

jest.mock('../purchasesSdk/purchasesSdkWebLoader', () => ({
  isPurchasesSdkWebLoaded: () => mockIsPurchasesSdkWebLoaded(),
  loadPurchasesSdkWeb: jest.fn(async () => ({
    Purchases: {
      getSharedInstance: mockGetSharedInstance,
      isConfigured: mockIsConfigured,
    },
  })),
}));

jest.mock('../purchasesSdk/purchaseSdkUtils', () => ({
  __esModule: true,
  default: {
    generateRevenueCatAnonymousAppUserId: () =>
      mockGenerateAnonymousAppUserId(),
  },
}));

import { logoutPurchasesSdk } from './purchasesSdkLogout';

describe('logoutPurchasesSdk web', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAppUserId.mockReturnValue('onekey-user');
    mockIsConfigured.mockReturnValue(true);
    mockIsPurchasesSdkWebLoaded.mockReturnValue(true);
  });

  it('skips RevenueCat initialization when the web SDK was never loaded', async () => {
    mockIsPurchasesSdkWebLoaded.mockReturnValueOnce(false);

    await expect(logoutPurchasesSdk()).resolves.toBe(true);
    expect(mockGetSharedInstance).not.toHaveBeenCalled();
  });

  it('shares one in-flight anonymous-user reset across concurrent callers', async () => {
    let resolveChangeUser: (() => void) | undefined;
    mockChangeUser.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveChangeUser = resolve;
        }),
    );

    const firstLogout = logoutPurchasesSdk();
    const secondLogout = logoutPurchasesSdk();

    expect(secondLogout).toBe(firstLogout);
    await Promise.resolve();
    expect(mockGenerateAnonymousAppUserId).toHaveBeenCalledTimes(1);
    expect(mockChangeUser).toHaveBeenCalledTimes(1);

    resolveChangeUser?.();
    await expect(Promise.all([firstLogout, secondLogout])).resolves.toEqual([
      true,
      true,
    ]);

    mockChangeUser.mockResolvedValueOnce(undefined);
    await expect(logoutPurchasesSdk()).resolves.toBe(true);
    expect(mockGenerateAnonymousAppUserId).toHaveBeenCalledTimes(2);
    expect(mockChangeUser).toHaveBeenCalledTimes(2);
  });
});
