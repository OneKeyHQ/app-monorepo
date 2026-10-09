const mockGetInstallReferralAutoFill = jest.fn();
const mockPrefetch = jest.fn(async () => {});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceReferralCode: {
      getInstallReferralAutoFill: mockGetInstallReferralAutoFill,
    },
  },
}));

jest.mock(
  '@onekeyhq/kit/src/components/LastActivityTracker/installAttribution',
  () => ({
    prefetchInstallInviteCode: mockPrefetch,
  }),
);

const { readInstallReferralAutoFillCode } = jest.requireActual<
  typeof import('./installReferralAutoFill')
>('./installReferralAutoFill');

const pending = { code: undefined, isCaptureResolved: false };

describe('readInstallReferralAutoFillCode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a stored code without joining the capture', async () => {
    mockGetInstallReferralAutoFill.mockResolvedValue({
      code: 'ABC123',
      isCaptureResolved: true,
    });

    await expect(
      readInstallReferralAutoFillCode({
        timeoutMs: 10_000,
        isActive: () => true,
      }),
    ).resolves.toBe('ABC123');
    expect(mockPrefetch).not.toHaveBeenCalled();
  });

  it('picks up a code captured after the dialog opened', async () => {
    let finishCapture: (() => void) | undefined;
    mockPrefetch.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishCapture = resolve;
        }),
    );
    mockGetInstallReferralAutoFill
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce({ code: 'ABC123', isCaptureResolved: true });

    const result = readInstallReferralAutoFillCode({
      timeoutMs: 10_000,
      isActive: () => true,
    });
    await Promise.resolve();
    await Promise.resolve();
    finishCapture?.();

    await expect(result).resolves.toBe('ABC123');
    expect(mockGetInstallReferralAutoFill).toHaveBeenCalledTimes(2);
  });

  it('answers once this launch attempt settles, even if the capture stays pending', async () => {
    mockGetInstallReferralAutoFill.mockResolvedValue(pending);

    await expect(
      readInstallReferralAutoFillCode({
        timeoutMs: 10_000,
        isActive: () => true,
      }),
    ).resolves.toBeUndefined();
    expect(mockPrefetch).toHaveBeenCalledTimes(1);
    expect(mockGetInstallReferralAutoFill).toHaveBeenCalledTimes(2);
  });

  it('gives up at the timeout', async () => {
    mockGetInstallReferralAutoFill.mockResolvedValue(pending);
    mockPrefetch.mockImplementationOnce(() => new Promise<void>(() => {}));

    await expect(
      readInstallReferralAutoFillCode({ timeoutMs: 5, isActive: () => true }),
    ).resolves.toBeUndefined();
    expect(mockGetInstallReferralAutoFill).toHaveBeenCalledTimes(1);
  });

  it('skips the final read once the dialog is gone', async () => {
    mockGetInstallReferralAutoFill.mockResolvedValue(pending);

    await expect(
      readInstallReferralAutoFillCode({
        timeoutMs: 10_000,
        isActive: () => false,
      }),
    ).resolves.toBeUndefined();
    expect(mockGetInstallReferralAutoFill).toHaveBeenCalledTimes(1);
  });
});
