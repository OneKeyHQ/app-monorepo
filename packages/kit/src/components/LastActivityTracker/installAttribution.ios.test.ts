const mockReadPending = jest.fn();
const mockSavePending = jest.fn(async (_record?: unknown) => true);
const mockClearPending = jest.fn(async () => {});
const mockPost = jest.fn();
const mockGetClient = jest.fn(async () => ({ post: mockPost }));
const mockReportAttribution = jest.fn();
const mockWhenInitialized = jest.fn(async () => {});

jest.mock('react-native', () => ({
  NativeModules: {
    AppClipAttribution: {
      clearPending: mockClearPending,
      readPending: mockReadPending,
      savePending: mockSavePending,
    },
  },
}));

jest.mock('@onekeyhq/shared/src/appApiClient/appApiClient', () => ({
  appApiClient: {
    getClient: mockGetClient,
  },
}));

jest.mock('@onekeyhq/shared/src/analytics', () => ({
  analytics: {
    whenInitialized: mockWhenInitialized,
  },
}));

jest.mock('@onekeyhq/shared/src/config/endpointsMap', () => ({
  getEndpointByServiceName: jest.fn(async () => 'https://utility.onekeycn.com'),
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      install: {
        reportAppClipInstallAttribution: mockReportAttribution,
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNativeMainThread: true,
  },
}));

const { reportInstallAttribution } = jest.requireActual<
  typeof import('./installAttribution.ios')
>('./installAttribution.ios');

const pendingRecord = {
  clickId: '0123456789ABCDEFGHIJKL',
  experience: 'market',
  lastAction: 'install_cta',
  route: '/clip/market',
  schemaVersion: 1,
  selectedAddress: '',
  selectedIsNative: true,
  selectedNetwork: 'btc--0',
  selectedSymbol: 'BTC',
};

describe('reportInstallAttribution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadPending.mockResolvedValue(pendingRecord);
    mockSavePending.mockResolvedValue(true);
  });

  it('reports a first claim and clears the shared record', async () => {
    mockPost.mockResolvedValue({
      data: {
        data: {
          alreadyClaimed: false,
          attribution: { utmSource: 'app-clip' },
          found: true,
        },
      },
    });

    await reportInstallAttribution();

    expect(mockReportAttribution).toHaveBeenCalledWith(
      expect.objectContaining({
        clickId: pendingRecord.clickId,
        selectedAddress: '',
        selectedIsNative: true,
        utmSource: 'app-clip',
      }),
    );
    expect(mockSavePending).toHaveBeenCalledWith(
      expect.objectContaining({
        clickId: pendingRecord.clickId,
        utmSource: 'app-clip',
      }),
    );
    expect(mockSavePending.mock.invocationCallOrder[0]).toBeLessThan(
      mockReportAttribution.mock.invocationCallOrder[0],
    );
    expect(mockClearPending).toHaveBeenCalledTimes(1);
  });

  it('reports the pending record for a repeated claim before clearing it', async () => {
    mockPost.mockResolvedValue({
      data: {
        data: {
          alreadyClaimed: true,
          found: true,
        },
      },
    });

    await reportInstallAttribution();

    expect(mockReportAttribution).toHaveBeenCalledWith(
      expect.objectContaining({
        clickId: pendingRecord.clickId,
        lastAction: pendingRecord.lastAction,
      }),
    );
    expect(mockClearPending).toHaveBeenCalledTimes(1);
  });

  it('clears a terminal missing claim', async () => {
    mockPost.mockResolvedValue({
      data: {
        data: {
          found: false,
        },
      },
    });

    await reportInstallAttribution();

    expect(mockReportAttribution).not.toHaveBeenCalled();
    expect(mockClearPending).toHaveBeenCalledTimes(1);
  });

  it('waits for analytics initialization before claiming', async () => {
    let resolveAnalytics: (() => void) | undefined;
    mockWhenInitialized.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveAnalytics = resolve;
        }),
    );
    mockPost.mockResolvedValue({
      data: {
        data: {
          found: false,
        },
      },
    });

    const report = reportInstallAttribution();
    await Promise.resolve();
    expect(mockGetClient).not.toHaveBeenCalled();

    resolveAnalytics?.();
    await report;
    expect(mockGetClient).toHaveBeenCalledTimes(1);
  });

  it('keeps the final local interaction over the server snapshot', async () => {
    mockPost.mockResolvedValue({
      data: {
        data: {
          appClip: {
            lastAction: 'viewed',
            selectedSymbol: 'ETH',
          },
          found: true,
          shortLink: {
            path: '/clip/market',
            version: 1,
          },
        },
      },
    });

    await reportInstallAttribution();

    expect(mockReportAttribution).toHaveBeenCalledWith(
      expect.objectContaining({
        lastAction: pendingRecord.lastAction,
        selectedSymbol: pendingRecord.selectedSymbol,
        shortLinkPath: '/clip/market',
        shortLinkVersion: 1,
      }),
    );
  });

  it('keeps the server UTM snapshot over the invocation URL fallback', async () => {
    mockReadPending.mockResolvedValue({
      ...pendingRecord,
      utmCampaign: 'url-campaign',
      utmSource: 'url-source',
    });
    mockPost.mockResolvedValue({
      data: {
        data: {
          attribution: {
            utmCampaign: 'server-campaign',
            utmSource: 'server-source',
          },
          found: true,
        },
      },
    });

    await reportInstallAttribution();

    expect(mockReportAttribution).toHaveBeenCalledWith(
      expect.objectContaining({
        utmCampaign: 'server-campaign',
        utmSource: 'server-source',
      }),
    );
  });

  it('clears stale server selection when the final local CTA has no asset', async () => {
    mockReadPending.mockResolvedValue({
      clickId: pendingRecord.clickId,
      experience: 'market',
      lastAction: 'install_cta',
      route: '/clip/market',
      schemaVersion: 1,
    });
    mockPost.mockResolvedValue({
      data: {
        data: {
          appClip: {
            selectedAddress: '0xserver',
            selectedIsNative: false,
            selectedNetwork: 'evm--1',
            selectedSymbol: 'ETH',
          },
          found: true,
        },
      },
    });

    await reportInstallAttribution();

    const reported = mockReportAttribution.mock.calls[0][0];
    expect(reported).not.toHaveProperty('selectedAddress');
    expect(reported).not.toHaveProperty('selectedIsNative');
    expect(reported).not.toHaveProperty('selectedNetwork');
    expect(reported).not.toHaveProperty('selectedSymbol');
  });

  it('retries analytics with the persisted first-claim snapshot', async () => {
    let persistedRecord: unknown;
    mockSavePending.mockImplementation(async (record) => {
      persistedRecord = record;
      return true;
    });
    mockPost
      .mockResolvedValueOnce({
        data: {
          data: {
            appClip: {
              firstOpenedAt: '2026-09-08T08:00:00.000Z',
            },
            attribution: {
              utmSource: 'server-source',
            },
            found: true,
            shortLink: {
              path: '/campaign/app-clip',
              version: 2,
            },
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            alreadyClaimed: true,
            found: true,
          },
        },
      });
    mockReportAttribution.mockRejectedValueOnce(
      new Error('analytics unavailable'),
    );

    await expect(reportInstallAttribution()).rejects.toThrow(
      'analytics unavailable',
    );
    expect(mockClearPending).not.toHaveBeenCalled();

    mockReadPending.mockImplementationOnce(async () => persistedRecord);
    await reportInstallAttribution();

    expect(mockReportAttribution).toHaveBeenLastCalledWith(
      expect.objectContaining({
        firstOpenedAt: '2026-09-08T08:00:00.000Z',
        shortLinkPath: '/campaign/app-clip',
        shortLinkVersion: 2,
        utmSource: 'server-source',
      }),
    );
    expect(mockClearPending).toHaveBeenCalledTimes(1);
  });

  it('does not report again when cleanup retries after analytics succeeds', async () => {
    mockPost.mockResolvedValue({
      data: {
        data: {
          found: true,
        },
      },
    });
    mockClearPending.mockRejectedValueOnce(new Error('cleanup failed'));

    await expect(reportInstallAttribution()).rejects.toThrow('cleanup failed');

    expect(mockReportAttribution).toHaveBeenCalledTimes(1);
    expect(mockSavePending).toHaveBeenLastCalledWith(
      expect.objectContaining({
        clickId: pendingRecord.clickId,
        reportCompleted: true,
      }),
    );

    mockReadPending.mockResolvedValueOnce({
      ...pendingRecord,
      reportCompleted: true,
    });
    await reportInstallAttribution();

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockReportAttribution).toHaveBeenCalledTimes(1);
    expect(mockClearPending).toHaveBeenCalledTimes(2);
  });

  it('keeps the pending record when the first-claim snapshot cannot persist', async () => {
    mockPost.mockResolvedValue({
      data: {
        data: {
          found: true,
        },
      },
    });
    mockSavePending.mockResolvedValueOnce(false);

    await expect(reportInstallAttribution()).rejects.toThrow(
      'Failed to persist App Clip attribution snapshot.',
    );

    expect(mockReportAttribution).not.toHaveBeenCalled();
    expect(mockClearPending).not.toHaveBeenCalled();
  });

  it('keeps the pending record when report completion cannot persist', async () => {
    mockPost.mockResolvedValue({
      data: {
        data: {
          found: true,
        },
      },
    });
    mockSavePending.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(reportInstallAttribution()).rejects.toThrow(
      'Failed to persist App Clip attribution report completion.',
    );

    expect(mockReportAttribution).toHaveBeenCalledTimes(1);
    expect(mockSavePending).toHaveBeenCalledTimes(2);
    expect(mockClearPending).not.toHaveBeenCalled();
  });

  it('deduplicates concurrent attribution consumption', async () => {
    let resolvePending: ((value: unknown) => void) | undefined;
    mockReadPending.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePending = resolve;
        }),
    );

    const first = reportInstallAttribution();
    const second = reportInstallAttribution();
    expect(first).toBe(second);
    expect(mockReadPending).toHaveBeenCalledTimes(1);

    resolvePending?.(null);
    await Promise.all([first, second]);
  });
});
