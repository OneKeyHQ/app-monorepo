const mockGet = jest.fn<
  Promise<{ headers: { date?: string } }>,
  [string, unknown]
>();
const mockEmit = jest.fn<void, [string, unknown]>();
const mockTimeCheckLog = jest.fn();
const mockTimeRefreshLog = jest.fn();
const mockGetClient = jest.fn(async () => ({ get: mockGet }));

jest.mock('../appApiClient/appApiClient', () => ({
  appApiClient: {
    getClient: () => mockGetClient(),
  },
}));

jest.mock('../config/appConfig', () => ({
  ONEKEY_HEALTH_CHECK_URL: '/wallet/v1/health',
}));

jest.mock('../config/endpointsMap', () => ({
  getEndpointByServiceName: async () => 'https://wallet.onekeycn.com',
}));

jest.mock('../eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    LocalSystemTimeInvalid: 'LocalSystemTimeInvalid',
    LocalSystemTimeStatusChanged: 'LocalSystemTimeStatusChanged',
  },
  appEventBus: { emit: (...args: [string, unknown]) => mockEmit(...args) },
}));

jest.mock('../platformEnv', () => ({
  __esModule: true,
  default: { isDesktop: true },
}));

jest.mock('../logger/logger', () => ({
  defaultLogger: {
    app: {
      systemTime: { check: mockTimeCheckLog, refresh: mockTimeRefreshLog },
    },
  },
}));

jest.mock('../request/requestHelper', () => ({
  __esModule: true,
  default: { checkIsOneKeyDomain: async () => true },
}));

jest.mock('../storage/appStorage', () => ({
  __esModule: true,
  default: {
    syncStorage: {
      getNumber: () => undefined,
      set: jest.fn(),
    },
  },
}));

const BASE_TIME = Date.parse('2030-01-01T00:00:00.000Z');
const MINUTE = 60_000;
const SLEEP_TIME = 12 * 60 * MINUTE;
let monotonicTime: number;
let systemTimeUtils: typeof import('./systemTimeUtils').default;

function expectNoTimeError() {
  expect(mockEmit).not.toHaveBeenCalledWith(
    'LocalSystemTimeInvalid',
    undefined,
  );
}

describe('system time error notifications', () => {
  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    mockGet.mockReset();
    mockGetClient.mockReset();
    mockGetClient.mockImplementation(async () => ({ get: mockGet }));
    jest.useFakeTimers({ doNotFake: ['performance'] });
    jest.setSystemTime(BASE_TIME);
    monotonicTime = 1000;
    jest.spyOn(performance, 'now').mockImplementation(() => monotonicTime);
    systemTimeUtils = (await import('./systemTimeUtils')).default;
    systemTimeUtils.updateServerTime({ serverTime: BASE_TIME });
    mockEmit.mockClear();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('keeps initial and periodic healthy time checks silent', async () => {
    mockGet.mockImplementation(async () => ({
      headers: { date: new Date(Date.now()).toUTCString() },
    }));
    systemTimeUtils.startServerTimeInterval();

    for (let i = 0; i < 3; i += 1) {
      monotonicTime += 5 * MINUTE;
      await jest.advanceTimersByTimeAsync(5 * MINUTE);
    }

    expect(mockGet).toHaveBeenCalledTimes(4);
    expect(systemTimeUtils.systemTimeStatus).toBe('VALID');
    expect(mockTimeCheckLog).not.toHaveBeenCalled();
    expect(mockTimeRefreshLog).not.toHaveBeenCalled();
  });

  it('logs the first anomaly and recovery while bounding rapid state changes', () => {
    for (let i = 0; i < 20; i += 1) {
      monotonicTime += 1000;
      jest.setSystemTime(Date.now() + 1000);
      systemTimeUtils.updateServerTime({
        serverTime: BASE_TIME,
        localTime: BASE_TIME + 20 * MINUTE,
      });
      systemTimeUtils.updateServerTime({
        serverTime: BASE_TIME,
        localTime: BASE_TIME,
      });
    }

    expect(mockTimeCheckLog).toHaveBeenCalledTimes(2);
    expect(mockTimeCheckLog).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ status: 'INVALID', differenceMs: 20 * MINUTE }),
    );
    expect(mockTimeCheckLog).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ previousStatus: 'INVALID', status: 'VALID' }),
    );

    monotonicTime += MINUTE;
    jest.setSystemTime(Date.now() + MINUTE);
    systemTimeUtils.updateServerTime({
      serverTime: BASE_TIME,
      localTime: BASE_TIME + 20 * MINUTE,
    });
    expect(mockTimeCheckLog).toHaveBeenCalledTimes(3);
    expect(mockTimeCheckLog).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'INVALID', suppressedCount: 19 }),
    );
  });

  it('retains a rate-limited recovery for the next healthy check', () => {
    systemTimeUtils.updateServerTime({
      serverTime: BASE_TIME,
      localTime: BASE_TIME + 20 * MINUTE,
    });
    monotonicTime += MINUTE;
    jest.setSystemTime(Date.now() + MINUTE);
    systemTimeUtils.updateServerTime({ serverTime: BASE_TIME });
    systemTimeUtils.updateServerTime({
      serverTime: BASE_TIME,
      localTime: BASE_TIME + 20 * MINUTE,
    });
    systemTimeUtils.updateServerTime({ serverTime: BASE_TIME });
    expect(mockTimeCheckLog).toHaveBeenCalledTimes(3);

    monotonicTime += MINUTE;
    jest.setSystemTime(Date.now() + MINUTE);
    systemTimeUtils.updateServerTime({ serverTime: BASE_TIME });
    expect(mockTimeCheckLog).toHaveBeenCalledTimes(4);
    expect(mockTimeCheckLog).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'VALID', suppressedCount: 1 }),
    );
    systemTimeUtils.updateServerTime({ serverTime: BASE_TIME });
    expect(mockTimeCheckLog).toHaveBeenCalledTimes(4);
  });

  it('bounds repeated refresh failures and reports the suppressed count', async () => {
    mockGet.mockRejectedValue(new Error('Offline'));
    for (let i = 0; i < 10; i += 1) {
      await expect(systemTimeUtils.refreshServerTime()).rejects.toThrow(
        'Offline',
      );
    }
    expect(mockTimeRefreshLog).toHaveBeenCalledTimes(1);

    monotonicTime += MINUTE;
    jest.setSystemTime(Date.now() + MINUTE);
    await expect(systemTimeUtils.refreshServerTime()).rejects.toThrow(
      'Offline',
    );
    expect(mockTimeRefreshLog).toHaveBeenCalledTimes(2);
    expect(mockTimeRefreshLog).toHaveBeenLastCalledWith(
      expect.objectContaining({ result: 'request-error', suppressedCount: 9 }),
    );
  });

  it.each(['network failure', 'missing Date'])(
    'does not blame the local clock after sleep and %s, preserving sync guards',
    async (failure) => {
      if (failure === 'network failure') {
        mockGet.mockRejectedValue(new Error('Offline after resume'));
      } else {
        mockGet.mockResolvedValue({ headers: {} });
      }
      systemTimeUtils.startServerTimeInterval();
      jest.setSystemTime(BASE_TIME + SLEEP_TIME);
      monotonicTime += 5 * MINUTE;
      await jest.advanceTimersByTimeAsync(5 * MINUTE);

      expectNoTimeError();
      expect(systemTimeUtils.systemTimeStatus).toBe('INVALID');
      expect(systemTimeUtils.isTimeErrorConfirmed).toBe(false);
      expect(mockEmit).toHaveBeenCalledWith('LocalSystemTimeStatusChanged', {
        status: 'INVALID',
        isTimeErrorConfirmed: false,
      });
      expect(systemTimeUtils.getEstimatedServerTime()).toBe(
        BASE_TIME + 5 * MINUTE,
      );
      expect(systemTimeUtils.getCorrectedCloudSyncNow()).toEqual({
        time: BASE_TIME + 5 * MINUTE,
        source: 'estimated',
      });
      expect(
        systemTimeUtils.isCloudSyncDataTimeFuturePoisoned({
          dataTime: BASE_TIME + SLEEP_TIME,
          tolerance: 10 * MINUTE,
        }),
      ).toBe(true);
      expect(systemTimeUtils.getTimeNow()).toBe(BASE_TIME + 1);
    },
  );

  it('keeps an awake clock valid when the periodic request fails', async () => {
    mockGet.mockRejectedValue(new Error('Offline'));
    systemTimeUtils.startServerTimeInterval();
    monotonicTime += 5 * MINUTE;
    await jest.advanceTimersByTimeAsync(5 * MINUTE);

    expectNoTimeError();
    expect(systemTimeUtils.systemTimeStatus).toBe('VALID');
  });

  it.each([10 * MINUTE, 20 * MINUTE, -20 * MINUTE])(
    'still reports a local clock offset of %i ms confirmed by a fresh response',
    async (offset) => {
      jest.setSystemTime(BASE_TIME + offset);
      mockGet.mockResolvedValue({
        headers: { date: new Date(BASE_TIME).toUTCString() },
      });

      await expect(systemTimeUtils.refreshServerTime()).resolves.toBe(true);

      expect(systemTimeUtils.systemTimeStatus).toBe('INVALID');
      expect(systemTimeUtils.isTimeErrorConfirmed).toBe(true);
      expect(mockEmit).toHaveBeenLastCalledWith(
        'LocalSystemTimeInvalid',
        undefined,
      );
    },
  );

  it('recovers through the existing time update when a fresh response arrives after sleep', async () => {
    mockGet.mockRejectedValueOnce(new Error('Offline after resume'));
    systemTimeUtils.startServerTimeInterval();
    jest.setSystemTime(BASE_TIME + SLEEP_TIME);
    monotonicTime += 5 * MINUTE;
    await jest.advanceTimersByTimeAsync(5 * MINUTE);
    expect(systemTimeUtils.systemTimeStatus).toBe('INVALID');

    const now = Date.now();
    mockGet.mockResolvedValue({
      headers: { date: new Date(now).toUTCString() },
    });
    await systemTimeUtils.refreshServerTime();

    expectNoTimeError();
    expect(systemTimeUtils.systemTimeStatus).toBe('VALID');
    expect(systemTimeUtils.isTimeErrorConfirmed).toBe(false);
    expect(systemTimeUtils.lastServerTime).toBe(now);
    expect(systemTimeUtils.getCorrectedCloudSyncNow()).toEqual({
      time: now,
      source: 'estimated',
    });
  });

  it.each([SLEEP_TIME, -SLEEP_TIME])(
    'does not notify when wall time jumps by %i ms during the health request',
    async (elapsed) => {
      mockGet.mockImplementation(async () => {
        jest.setSystemTime(BASE_TIME + elapsed);
        monotonicTime += 1000;
        return { headers: { date: new Date(BASE_TIME).toUTCString() } };
      });

      await expect(systemTimeUtils.refreshServerTime()).resolves.toBe(true);

      expectNoTimeError();
      expect(systemTimeUtils.systemTimeStatus).toBe('INVALID');
      expect(systemTimeUtils.isTimeErrorConfirmed).toBe(false);
      expect(systemTimeUtils.lastServerTime).toBe(BASE_TIME);
      expect(mockTimeRefreshLog).toHaveBeenCalledWith(
        expect.objectContaining({
          result: 'stale-response',
          requestDurationMs: elapsed,
        }),
      );
    },
  );

  it('does not notify for an old business response while preserving its time update', async () => {
    jest.setSystemTime(BASE_TIME + SLEEP_TIME);

    await systemTimeUtils.handleServerResponseDate({
      source: 'axios',
      headerDate: new Date(BASE_TIME).toUTCString(),
      url: 'https://wallet.onekeycn.com/wallet/v1/network/list',
    });

    expectNoTimeError();
    expect(systemTimeUtils.systemTimeStatus).toBe('INVALID');
    expect(systemTimeUtils.lastServerTime).toBe(BASE_TIME);
  });

  it('notifies once when the health response also passes through the interceptor', async () => {
    jest.setSystemTime(BASE_TIME + 20 * MINUTE);
    const date = new Date(BASE_TIME).toUTCString();
    mockGet.mockImplementation(async () => {
      await systemTimeUtils.handleServerResponseDate({
        source: 'axios',
        headerDate: date,
        url: 'https://wallet.onekeycn.com/wallet/v1/health',
      });
      return { headers: { date } };
    });

    await systemTimeUtils.refreshServerTime();

    expect(
      mockEmit.mock.calls.filter(([name]) => name === 'LocalSystemTimeInvalid'),
    ).toHaveLength(1);
  });

  it('confirms a real clock error despite slow client setup and a network retry', async () => {
    jest.setSystemTime(BASE_TIME + 20 * MINUTE);
    mockGetClient.mockImplementation(async () => {
      jest.setSystemTime(Date.now() + 20_000);
      monotonicTime += 20_000;
      return { get: mockGet };
    });
    mockGet.mockImplementation(async () => {
      jest.setSystemTime(Date.now() + 11_000);
      monotonicTime += 11_000;
      return {
        headers: { date: new Date(BASE_TIME + 31_000).toUTCString() },
      };
    });

    await systemTimeUtils.refreshServerTime();

    expect(systemTimeUtils.isTimeErrorConfirmed).toBe(true);
    expect(mockEmit).toHaveBeenCalledWith('LocalSystemTimeStatusChanged', {
      status: 'INVALID',
      isTimeErrorConfirmed: true,
    });
    expect(mockEmit).toHaveBeenCalledWith('LocalSystemTimeInvalid', undefined);
    expect(mockTimeRefreshLog).not.toHaveBeenCalled();
  });

  it('checks the clock on startup even when a business response already seeded it', async () => {
    jest.setSystemTime(BASE_TIME + 20 * MINUTE);
    systemTimeUtils.updateServerTime({ serverTime: BASE_TIME });
    expect(systemTimeUtils.hasFreshServerTimeInCurrentProcess()).toBe(true);
    expect(systemTimeUtils.isTimeErrorConfirmed).toBe(false);
    mockGet.mockResolvedValue({
      headers: { date: new Date(BASE_TIME).toUTCString() },
    });

    systemTimeUtils.startServerTimeInterval();
    await jest.advanceTimersByTimeAsync(0);

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(systemTimeUtils.isTimeErrorConfirmed).toBe(true);
    expect(mockEmit).toHaveBeenCalledWith('LocalSystemTimeInvalid', undefined);
  });

  it('does not confirm a delayed response when both clocks include sleep', async () => {
    mockGet.mockImplementation(async () => {
      jest.setSystemTime(Date.now() + SLEEP_TIME);
      monotonicTime += SLEEP_TIME;
      return { headers: { date: new Date(BASE_TIME).toUTCString() } };
    });

    await systemTimeUtils.refreshServerTime();

    expectNoTimeError();
    expect(systemTimeUtils.isTimeErrorConfirmed).toBe(false);
    expect(mockTimeRefreshLog).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'stale-response' }),
    );
  });

  it.each([SLEEP_TIME, -MINUTE])(
    'records another anomaly after a wall-clock change of %i ms with no monotonic advance',
    async (elapsed) => {
      mockGet.mockRejectedValue(new Error('Offline'));
      await expect(systemTimeUtils.refreshServerTime()).rejects.toThrow(
        'Offline',
      );
      systemTimeUtils.updateServerTime({
        serverTime: BASE_TIME,
        localTime: BASE_TIME + 20 * MINUTE,
      });
      jest.setSystemTime(Date.now() + elapsed);

      await expect(systemTimeUtils.refreshServerTime()).rejects.toThrow(
        'Offline',
      );
      systemTimeUtils.updateServerTime({
        serverTime: BASE_TIME,
        localTime: BASE_TIME + 20 * MINUTE,
      });

      expect(mockTimeRefreshLog).toHaveBeenCalledTimes(2);
      expect(mockTimeCheckLog).toHaveBeenCalledTimes(2);
    },
  );

  it('clears display confirmation on recovery without changing the sync status rules', async () => {
    jest.setSystemTime(BASE_TIME + 20 * MINUTE);
    mockGet.mockResolvedValue({
      headers: { date: new Date(BASE_TIME).toUTCString() },
    });
    await systemTimeUtils.refreshServerTime();
    expect(systemTimeUtils.isTimeErrorConfirmed).toBe(true);

    systemTimeUtils.updateServerTime({ serverTime: BASE_TIME });
    expect(systemTimeUtils.isTimeErrorConfirmed).toBe(true);

    systemTimeUtils.updateServerTime({ serverTime: Date.now() });

    expect(systemTimeUtils.systemTimeStatus).toBe('VALID');
    expect(systemTimeUtils.isTimeErrorConfirmed).toBe(false);
    expect(mockEmit).toHaveBeenLastCalledWith('LocalSystemTimeStatusChanged', {
      status: 'VALID',
      isTimeErrorConfirmed: false,
    });
  });

  it('revokes previous confirmation when sleep leaves only an estimated comparison', async () => {
    jest.setSystemTime(BASE_TIME + 20 * MINUTE);
    mockGet.mockResolvedValueOnce({
      headers: { date: new Date(BASE_TIME).toUTCString() },
    });
    systemTimeUtils.startServerTimeInterval();
    await jest.advanceTimersByTimeAsync(0);
    expect(systemTimeUtils.isTimeErrorConfirmed).toBe(true);
    mockEmit.mockClear();
    mockGet.mockRejectedValue(new Error('Offline after resume'));
    jest.setSystemTime(Date.now() + SLEEP_TIME);

    await jest.advanceTimersByTimeAsync(5 * MINUTE);

    expectNoTimeError();
    expect(systemTimeUtils.systemTimeStatus).toBe('INVALID');
    expect(systemTimeUtils.isTimeErrorConfirmed).toBe(false);
    expect(mockEmit).toHaveBeenCalledWith('LocalSystemTimeStatusChanged', {
      status: 'INVALID',
      isTimeErrorConfirmed: false,
    });
  });
});
