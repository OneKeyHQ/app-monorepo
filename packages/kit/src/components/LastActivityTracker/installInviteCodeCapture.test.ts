const mockGetCaptureState = jest.fn(async () => ({
  isResolved: false,
  isPendingFreshInstall: false,
}));
const mockResolve = jest.fn(async (_params: unknown) => ({
  isResolved: true,
  hasCode: true,
}));
const mockMarkResolved = jest.fn(async () => {});
const mockMarkFresh = jest.fn(async () => {});
const mockCaptured = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceReferralCode: {
      getInstallReferralCaptureState: mockGetCaptureState,
      resolveInstallReferral: mockResolve,
      markInstallReferralCaptureResolved: mockMarkResolved,
      markInstallReferralPendingFreshInstall: mockMarkFresh,
    },
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    referral: { page: { installReferralCaptured: mockCaptured } },
  },
}));

const { captureInstallInviteCode } = jest.requireActual<
  typeof import('./installInviteCodeCapture')
>('./installInviteCodeCapture');

describe('captureInstallInviteCode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores a fresh install code and reports the capture', async () => {
    await captureInstallInviteCode({
      source: 'androidInstallReferrer' as never,
      read: async () => ({
        code: 'ABC123',
        attributedAt: 1,
        hasReferrer: true,
        isExistingInstall: false,
      }),
    });

    expect(mockResolve).toHaveBeenCalledWith({
      code: 'ABC123',
      attributedAt: 1,
      hasReferrer: true,
      source: 'androidInstallReferrer',
    });
    expect(mockCaptured).toHaveBeenCalledWith({
      source: 'androidInstallReferrer',
      hasCode: true,
    });
  });

  it('settles an existing install without storing or reporting a capture', async () => {
    await captureInstallInviteCode({
      source: 'androidInstallReferrer' as never,
      read: async () => ({
        code: undefined,
        attributedAt: 1,
        hasReferrer: false,
        isExistingInstall: true,
      }),
    });

    expect(mockMarkResolved).toHaveBeenCalledTimes(1);
    expect(mockResolve).not.toHaveBeenCalled();
    expect(mockCaptured).not.toHaveBeenCalled();
  });

  it('skips the read once a previous launch resolved the capture', async () => {
    mockGetCaptureState.mockResolvedValueOnce({
      isResolved: true,
      isPendingFreshInstall: false,
    });
    const read = jest.fn();

    await captureInstallInviteCode({
      source: 'iosAppClip' as never,
      read,
    });

    expect(read).not.toHaveBeenCalled();
  });

  it('tells the reader when an earlier launch judged this install fresh', async () => {
    mockGetCaptureState.mockResolvedValueOnce({
      isResolved: false,
      isPendingFreshInstall: true,
    });
    const read = jest.fn(async () => undefined);

    await captureInstallInviteCode({
      source: 'androidInstallReferrer' as never,
      read,
    });

    expect(read).toHaveBeenCalledWith(
      expect.objectContaining({ isKnownFreshInstall: true }),
    );
  });

  it('keeps the fresh-install judgement when the store read then fails', async () => {
    await captureInstallInviteCode({
      source: 'androidInstallReferrer' as never,
      read: async ({ markFreshInstall }) => {
        await markFreshInstall();
        throw new Error('SERVICE_UNAVAILABLE');
      },
    });

    expect(mockMarkFresh).toHaveBeenCalledTimes(1);
    expect(mockResolve).not.toHaveBeenCalled();
    expect(mockMarkResolved).not.toHaveBeenCalled();
  });
});
