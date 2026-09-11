import { logoutPurchasesSdk } from './purchasesSdkLogout.desktop';

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

jest.mock('./purchasesSdkLogoutWeb', () => ({
  logoutPurchasesSdk: () => mockWebLogOut(),
}));

describe('desktop purchases logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsMas = true;
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: { inAppPurchase: { revenueCatLogOut: () => mockLogOut() } },
    });
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
    expect(mockLogOut).toHaveBeenCalledTimes(1);
    complete?.();
    await expect(first).resolves.toBe(true);
    expect(mockWebLogOut).not.toHaveBeenCalled();
  });

  it('preserves web billing logout for direct desktop builds', async () => {
    mockIsMas = false;
    await expect(logoutPurchasesSdk()).resolves.toBe(true);
    expect(mockWebLogOut).toHaveBeenCalledTimes(1);
    expect(mockLogOut).not.toHaveBeenCalled();
  });
});
