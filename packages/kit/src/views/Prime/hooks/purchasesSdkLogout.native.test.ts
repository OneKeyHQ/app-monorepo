import fs from 'fs';

import { logoutPurchasesSdk } from './purchasesSdkLogout.native';

const mockLogOut = jest.fn();

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    logOut: (): void => {
      mockLogOut();
    },
  },
}));

describe('logoutPurchasesSdk native startup boundary', () => {
  beforeEach(() => {
    mockLogOut.mockReset();
  });

  it('loads RevenueCat only when logout is requested', async () => {
    const source = fs.readFileSync(__filename.replace(/\.test\.ts$/, '.ts'));

    expect(source.toString()).toMatch(
      /await\s+import\(\s*['"]react-native-purchases['"]\s*\)/,
    );
    expect(source.toString()).not.toMatch(
      /import\s+PurchasesReactNative\s+from/,
    );

    await logoutPurchasesSdk();

    expect(mockLogOut).toHaveBeenCalledTimes(1);
  });
});
