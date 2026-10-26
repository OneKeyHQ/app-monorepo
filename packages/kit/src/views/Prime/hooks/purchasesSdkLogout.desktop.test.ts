import { DesktopApiProxy } from '@onekeyhq/kit-bg/src/desktopApis/instance/desktopApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { logoutPurchasesSdk } from './purchasesSdkLogout.desktop';

const mockIsAvailable = jest.fn(async () => true);
const mockLogOut = jest.fn<Promise<void>, []>();
const mockWebLogOut = jest.fn(async () => true);
let mockIsMas = true;

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isMas() {
      return mockIsMas;
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnvLite', () => ({
  __esModule: true,
  default: { isDesktop: true },
}));

jest.mock('./purchasesSdkLogoutWeb', () => ({
  logoutPurchasesSdk: () => mockWebLogOut(),
}));

describe('desktop purchases logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsMas = true;
    mockIsAvailable.mockResolvedValue(true);
    mockLogOut.mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        inAppPurchase: {
          revenueCatIsAvailable: () => mockIsAvailable(),
          revenueCatLogOut: () => mockLogOut(),
        },
      },
    });
  });

  it('skips logout when an older shell rejects the capability probe through the real proxy', async () => {
    const call = jest.fn(async () => {
      throw new OneKeyLocalError('Unknown IPC method');
    });
    Object.defineProperty(globalThis, 'desktopApiBridge', {
      configurable: true,
      value: { call },
    });
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: new DesktopApiProxy(),
    });

    expect(
      typeof globalThis.desktopApiProxy.inAppPurchase.revenueCatLogOut,
    ).toBe('function');
    await expect(logoutPurchasesSdk()).resolves.toBe(true);
    expect(call.mock.calls).toEqual([
      ['inAppPurchase', 'revenueCatIsAvailable'],
    ]);
    expect(mockLogOut).not.toHaveBeenCalled();
    expect(mockWebLogOut).not.toHaveBeenCalled();
  });

  it('skips logout when the native bridge reports that it is unavailable', async () => {
    mockIsAvailable.mockResolvedValue(false);

    await expect(logoutPurchasesSdk()).resolves.toBe(true);
    expect(mockIsAvailable).toHaveBeenCalledTimes(1);
    expect(mockLogOut).not.toHaveBeenCalled();
  });

  it('skips logout when the desktop API is missing', async () => {
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: undefined,
    });

    await expect(logoutPurchasesSdk()).resolves.toBe(true);
    expect(mockIsAvailable).not.toHaveBeenCalled();
    expect(mockLogOut).not.toHaveBeenCalled();
  });

  it('keeps a supported bridge logout failure retryable', async () => {
    mockLogOut.mockRejectedValueOnce(new Error('Store connection failed'));

    await expect(logoutPurchasesSdk()).resolves.toBe(false);
    await expect(logoutPurchasesSdk()).resolves.toBe(true);
    expect(mockIsAvailable).toHaveBeenCalledTimes(2);
    expect(mockLogOut).toHaveBeenCalledTimes(2);
    expect(mockWebLogOut).not.toHaveBeenCalled();
  });

  it('shares one native reset across concurrent Mac App Store callers', async () => {
    let complete: (() => void) | undefined;
    mockLogOut.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const first = logoutPurchasesSdk();
    const second = logoutPurchasesSdk();
    expect(first).toBe(second);
    expect(mockIsAvailable).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(mockLogOut).toHaveBeenCalledTimes(1);
    complete?.();
    await expect(first).resolves.toBe(true);
    expect(mockWebLogOut).not.toHaveBeenCalled();
  });

  it('preserves web billing logout for direct desktop builds', async () => {
    mockIsMas = false;
    await expect(logoutPurchasesSdk()).resolves.toBe(true);
    expect(mockWebLogOut).toHaveBeenCalledTimes(1);
    expect(mockIsAvailable).not.toHaveBeenCalled();
    expect(mockLogOut).not.toHaveBeenCalled();
  });
});
