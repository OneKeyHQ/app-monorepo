/* eslint-disable import/first */

const mockLogOut = jest.fn<Promise<void>, []>();
let mockRevenueCatModuleLoadCount = 0;

jest.mock('react-native-purchases', () => {
  mockRevenueCatModuleLoadCount += 1;
  return {
    __esModule: true,
    default: {
      logOut: () => mockLogOut(),
    },
  };
});

import { logoutPurchasesSdk } from './purchasesSdkLogout.native';

describe('logoutPurchasesSdk native', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads RevenueCat only when logout is requested', async () => {
    expect(mockRevenueCatModuleLoadCount).toBe(0);

    mockLogOut.mockResolvedValueOnce(undefined);
    await expect(logoutPurchasesSdk()).resolves.toBe(true);

    expect(mockRevenueCatModuleLoadCount).toBe(1);
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
