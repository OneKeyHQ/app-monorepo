const mockCreateSource = jest.fn(() => ({
  getInstallReferrer: jest.fn(),
  getInstallationTime: jest.fn(),
  getLastUpdateTime: jest.fn(),
}));
const mockReport = jest.fn(async (_source: unknown) => {});
const mockReadInviteCode = jest.fn(async (_source: unknown) => ({
  code: 'ABC123',
  installedAt: 1_757_318_400_000,
  hasReferrer: true,
}));
const mockCaptureInstallInviteCode = jest.fn(
  async ({ read }: { source: string; read: () => Promise<unknown> }) => {
    await read();
  },
);

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNativeAndroidGooglePlay: true,
    isNativeMainThread: true,
  },
}));

jest.mock('@onekeyhq/shared/src/modules/InstallAttribution/googlePlay', () => ({
  createInstallAttributionSource: mockCreateSource,
  readGooglePlayInviteCodeAttribution: mockReadInviteCode,
  reportGooglePlayInstallAttribution: mockReport,
}));

jest.mock('./installInviteCodeCapture', () => ({
  captureInstallInviteCode: mockCaptureInstallInviteCode,
}));

const { prefetchInstallInviteCode, reportInstallAttribution } =
  jest.requireActual<typeof import('./installAttribution.android')>(
    './installAttribution.android',
  );

describe('Google Play install attribution startup', () => {
  it('shares one capture and one referrer source between prefetch and report', async () => {
    const prefetch = prefetchInstallInviteCode();
    await reportInstallAttribution();
    await prefetch;

    expect(mockCaptureInstallInviteCode).toHaveBeenCalledTimes(1);
    expect(mockCaptureInstallInviteCode.mock.calls[0][0].source).toBe(
      'androidInstallReferrer',
    );
    expect(mockCreateSource).toHaveBeenCalledTimes(1);
    const source = mockCreateSource.mock.results[0]?.value as ReturnType<
      typeof mockCreateSource
    >;
    expect(mockReport).toHaveBeenCalledWith(source);
    expect(mockReadInviteCode).toHaveBeenCalledWith(source);
  });
});
