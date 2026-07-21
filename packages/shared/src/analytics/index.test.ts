import { Analytics } from '.';

const mockPost = jest.fn(() => Promise.resolve());
const mockGetDeviceCpuTier = jest.fn(() => 'high');
const mockGetDeviceInfo = jest.fn(() =>
  Promise.resolve({ deviceId: 'device-id' }),
);

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: () => ({ post: mockPost }),
  },
}));

jest.mock('../appGlobals', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../modules3rdParty/webEmebd/postMessage', () => ({
  EWebEmbedPostMessageType: { TrackEvent: 'TrackEvent' },
  postMessage: jest.fn(),
}));

jest.mock('../performance/devicePerformanceTier', () => ({
  getDeviceCpuTier: mockGetDeviceCpuTier,
}));

jest.mock('../platformEnv', () => ({
  __esModule: true,
  default: {
    appPlatform: 'web',
    buildNumber: '1',
    isDev: false,
    isE2E: false,
    isNative: false,
    isWebEmbed: false,
    version: '1.0.0',
  },
}));

jest.mock('../request/InterceptorConsts', () => ({
  headerPlatform: 'web',
}));

jest.mock('../utils/ipTableUtils', () => ({
  isSupportIpTablePlatform: () => false,
}));

jest.mock('./deviceInfo', () => ({
  getDeviceInfo: () => mockGetDeviceInfo(),
}));

async function waitForPostCount(expectedCount: number) {
  for (let i = 0; i < 10; i += 1) {
    if (mockPost.mock.calls.length >= expectedCount) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe('Analytics tier', () => {
  beforeEach(() => {
    mockPost.mockClear();
    mockGetDeviceCpuTier.mockClear();
    mockGetDeviceInfo.mockClear();
  });

  it('adds the resolved tier to event and profile requests', async () => {
    const analytics = new Analytics();
    analytics.init({ instanceId: 'instance-id', baseURL: 'https://utility' });

    analytics.trackEvent('testEvent', { tier: 1 });
    await waitForPostCount(1);

    expect(mockPost).toHaveBeenNthCalledWith(
      1,
      '/utility/v1/track/event',
      expect.objectContaining({
        eventName: 'testEvent',
        eventProps: expect.objectContaining({ tier: 3 }),
      }),
    );

    analytics.updateUserProfile({ hwWalletCount: 2 });
    await waitForPostCount(2);

    expect(mockPost).toHaveBeenNthCalledWith(
      2,
      '/utility/v1/track/attributes',
      expect.objectContaining({
        attributes: expect.objectContaining({ tier: 3 }),
      }),
    );
    expect(mockGetDeviceCpuTier).toHaveBeenCalledTimes(1);
  });

  it('shares complete device info across concurrent first requests', async () => {
    let resolveDeviceInfo:
      | ((deviceInfo: { deviceId: string }) => void)
      | undefined;
    mockGetDeviceInfo.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDeviceInfo = resolve;
      }),
    );
    const analytics = new Analytics();
    analytics.init({ instanceId: 'instance-id', baseURL: 'https://utility' });

    analytics.trackEvent('testEvent');
    analytics.updateUserProfile({ hwWalletCount: 2 });
    resolveDeviceInfo?.({ deviceId: 'device-id' });
    await waitForPostCount(2);

    expect(mockGetDeviceInfo).toHaveBeenCalledTimes(1);
    expect(mockGetDeviceCpuTier).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(mockPost).toHaveBeenCalledWith(
      '/utility/v1/track/event',
      expect.objectContaining({
        eventProps: expect.objectContaining({ tier: 3 }),
      }),
    );
    expect(mockPost).toHaveBeenCalledWith(
      '/utility/v1/track/attributes',
      expect.objectContaining({
        attributes: expect.objectContaining({ tier: 3 }),
      }),
    );
  });
});
