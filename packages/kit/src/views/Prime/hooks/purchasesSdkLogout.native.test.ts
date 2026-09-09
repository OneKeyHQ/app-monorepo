/* eslint-disable import/first */

const mockLogOut = jest.fn<Promise<void>, []>();

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    logOut: () => mockLogOut(),
  },
}));

import { logoutPurchasesSdk } from './purchasesSdkLogout.native';

describe('logoutPurchasesSdk native', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shares one in-flight RevenueCat logout across concurrent callers', async () => {
    let resolveLogOut: (() => void) | undefined;
    mockLogOut.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveLogOut = resolve;
        }),
    );

    const firstLogout = logoutPurchasesSdk();
    const secondLogout = logoutPurchasesSdk();

    expect(secondLogout).toBe(firstLogout);
    expect(mockLogOut).toHaveBeenCalledTimes(1);

    resolveLogOut?.();
    await expect(Promise.all([firstLogout, secondLogout])).resolves.toEqual([
      true,
      true,
    ]);

    mockLogOut.mockResolvedValueOnce(undefined);
    await expect(logoutPurchasesSdk()).resolves.toBe(true);
    expect(mockLogOut).toHaveBeenCalledTimes(2);
  });
});
