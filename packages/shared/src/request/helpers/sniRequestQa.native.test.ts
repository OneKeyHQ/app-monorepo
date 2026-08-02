import {
  clearDNSCache,
  getDebugSnapshot,
} from '@onekeyfe/react-native-sni-connect';

import { sniRequestQaAdapter } from './sniRequestQa.native';

jest.mock('@onekeyfe/react-native-sni-connect', () => ({
  clearDNSCache: jest.fn(),
  getDebugSnapshot: jest.fn(),
}));

const mockedClearDNSCache = clearDNSCache as jest.MockedFunction<
  typeof clearDNSCache
>;
const mockedGetDebugSnapshot = getDebugSnapshot as jest.MockedFunction<
  typeof getDebugSnapshot
>;

describe('sniRequestQaAdapter.native', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('forwards cache reset to the native module', async () => {
    mockedClearDNSCache.mockResolvedValue({ success: true });

    await expect(sniRequestQaAdapter.clearDNSCache()).resolves.toEqual({
      success: true,
    });
    expect(mockedClearDNSCache).toHaveBeenCalledTimes(1);
  });

  test('returns the count-only snapshot reported by the native limiter', async () => {
    mockedGetDebugSnapshot.mockResolvedValue({
      activeRequests: 16,
      activeRequestsForPair: 16,
      pendingRequests: 4,
      pendingRequestsForPair: 4,
    });

    await expect(
      sniRequestQaAdapter.getDebugSnapshot({
        hostname: 'wallet.onekeytest.com',
        ip: '104.18.31.39',
      }),
    ).resolves.toEqual({
      activeRequests: 16,
      activeRequestsForPair: 16,
      pendingRequests: 4,
      pendingRequestsForPair: 4,
    });
    expect(mockedGetDebugSnapshot).toHaveBeenCalledWith({
      hostname: 'wallet.onekeytest.com',
      ip: '104.18.31.39',
    });
  });
});
