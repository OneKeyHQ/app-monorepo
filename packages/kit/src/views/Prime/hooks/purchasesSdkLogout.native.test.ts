/* eslint-disable import/first */

import fs from 'fs';

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

  it('loads RevenueCat only when logout is requested', async () => {
    const source = fs.readFileSync(__filename.replace(/\.test\.ts$/, '.ts'));

    expect(source.toString()).toMatch(
      /await\s+import\(\s*['"]react-native-purchases['"]\s*\)/,
    );
    expect(source.toString()).not.toMatch(
      /import\s+PurchasesReactNative\s+from/,
    );

    mockLogOut.mockResolvedValueOnce(undefined);
    await expect(logoutPurchasesSdk()).resolves.toBe(true);

    expect(mockLogOut).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight RevenueCat logout across concurrent callers', async () => {
    let resolveLogOut: (() => void) | undefined;
    let resolveLogOutStarted: (() => void) | undefined;
    const logOutStarted = new Promise<void>((resolve) => {
      resolveLogOutStarted = resolve;
    });
    mockLogOut.mockImplementationOnce(() => {
      resolveLogOutStarted?.();
      return new Promise<void>((resolve) => {
        resolveLogOut = resolve;
      });
    });

    const firstLogout = logoutPurchasesSdk();
    const secondLogout = logoutPurchasesSdk();

    expect(secondLogout).toBe(firstLogout);
    await logOutStarted;
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
