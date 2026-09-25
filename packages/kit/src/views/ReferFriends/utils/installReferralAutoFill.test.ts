const mockGetInstallReferralAutoFill = jest.fn();
const mockWait = jest.fn(async (_ms: number) => {});
const mockPlatformEnv: {
  isNativeAndroidGooglePlay?: boolean;
  isNativeIOS?: boolean;
} = {};
const mockNativeModules: {
  AppClipAttribution?: { readInviteCode?: () => Promise<unknown> };
} = {};

jest.mock('react-native', () => ({
  NativeModules: mockNativeModules,
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceReferralCode: {
      getInstallReferralAutoFill: mockGetInstallReferralAutoFill,
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: mockPlatformEnv,
}));

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: { wait: mockWait },
}));

const { readInstallReferralAutoFillCode } = jest.requireActual<
  typeof import('./installReferralAutoFill')
>('./installReferralAutoFill');

const pending = { code: undefined, isCaptureResolved: false };

describe('readInstallReferralAutoFillCode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete mockPlatformEnv.isNativeAndroidGooglePlay;
    delete mockPlatformEnv.isNativeIOS;
    delete mockNativeModules.AppClipAttribution;
  });

  it('picks up a code captured after the dialog opened on Google Play', async () => {
    mockPlatformEnv.isNativeAndroidGooglePlay = true;
    mockGetInstallReferralAutoFill
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce({ code: 'ABC123', isCaptureResolved: true });

    await expect(
      readInstallReferralAutoFillCode({
        timeoutMs: 10_000,
        isActive: () => true,
      }),
    ).resolves.toBe('ABC123');
    expect(mockGetInstallReferralAutoFill).toHaveBeenCalledTimes(3);
  });

  it('picks up a code captured after the dialog opened on iOS', async () => {
    mockPlatformEnv.isNativeIOS = true;
    mockNativeModules.AppClipAttribution = {
      readInviteCode: async () => null,
    };
    mockGetInstallReferralAutoFill
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce({ code: 'ABC123', isCaptureResolved: true });

    await expect(
      readInstallReferralAutoFillCode({
        timeoutMs: 10_000,
        isActive: () => true,
      }),
    ).resolves.toBe('ABC123');
  });

  it('stops once the capture resolves without a code', async () => {
    mockPlatformEnv.isNativeAndroidGooglePlay = true;
    mockGetInstallReferralAutoFill
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce({ code: undefined, isCaptureResolved: true });

    await expect(
      readInstallReferralAutoFillCode({
        timeoutMs: 10_000,
        isActive: () => true,
      }),
    ).resolves.toBeUndefined();
    expect(mockGetInstallReferralAutoFill).toHaveBeenCalledTimes(2);
  });

  it('stops polling once the dialog is gone', async () => {
    mockPlatformEnv.isNativeAndroidGooglePlay = true;
    mockGetInstallReferralAutoFill.mockResolvedValue(pending);
    let isActive = true;
    mockWait.mockImplementationOnce(async () => {
      isActive = false;
    });

    await readInstallReferralAutoFillCode({
      timeoutMs: 10_000,
      isActive: () => isActive,
    });
    expect(mockGetInstallReferralAutoFill).toHaveBeenCalledTimes(2);
  });

  it('answers at once where no startup capture runs', async () => {
    mockPlatformEnv.isNativeIOS = true;
    mockGetInstallReferralAutoFill.mockResolvedValue(pending);

    await readInstallReferralAutoFillCode({
      timeoutMs: 10_000,
      isActive: () => true,
    });
    expect(mockGetInstallReferralAutoFill).toHaveBeenCalledTimes(1);
    expect(mockWait).not.toHaveBeenCalled();
  });
});
