/*
yarn test packages/kit-bg/src/services/ServiceDeFi.enabledNetworks.test.ts
*/

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
  toastIfError: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) => d,
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    DeFiEnabledNetworksChanged: 'DeFiEnabledNetworksChanged',
    DeFiPositionRefreshed: 'DeFiPositionRefreshed',
    LocalPendingTxConfirmed: 'LocalPendingTxConfirmed',
  },
  appEventBus: {
    emit: jest.fn(),
    on: jest.fn(),
  },
}));

jest.mock('../states/jotai/atoms/currency', () => ({
  currencyPersistAtom: {
    get: async () => ({ currencyMap: {} }),
  },
}));

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: {
    getTimeDurationMs: () => 10,
  },
}));

// eslint-disable-next-line import/first
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';

// eslint-disable-next-line import/first
import ServiceDeFi from './ServiceDeFi';

const mockAppEventBus = appEventBus as unknown as {
  emit: jest.Mock;
  on: jest.Mock;
};

type IEnabledNetworksState = {
  enabledNetworksMap: Record<string, boolean>;
};

function makeService(initialState: IEnabledNetworksState) {
  let storedState = initialState;
  let updateCount = 0;
  const updateWaiters: Array<{
    count: number;
    resolve: () => void;
  }> = [];
  const deFiDb = {
    getEnabledNetworksMap: jest.fn(async () => storedState.enabledNetworksMap),
    updateEnabledNetworksMap: jest.fn(
      async ({
        enabledNetworksMap,
      }: {
        enabledNetworksMap: Record<string, boolean>;
      }) => {
        storedState = {
          enabledNetworksMap,
        };
        updateCount += 1;
        updateWaiters
          .filter((waiter) => waiter.count <= updateCount)
          .forEach((waiter) => waiter.resolve());
      },
    ),
  };
  const Ctor = ServiceDeFi as unknown as new (args: {
    backgroundApi: unknown;
  }) => ServiceDeFi;
  const service = new Ctor({
    backgroundApi: {
      simpleDb: { deFi: deFiDb },
    },
  });

  return {
    deFiDb,
    getStoredState: () => storedState,
    service,
    waitForUpdate: (count: number) => {
      if (updateCount >= count) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        updateWaiters.push({ count, resolve });
      });
    },
  };
}

async function flushAsyncWork() {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

describe('DeFi enabled networks config cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('refreshes a persisted cache on first read and applies an added network', async () => {
    const { getStoredState, service, waitForUpdate } = makeService({
      enabledNetworksMap: { 'evm--1': true },
    });
    const fetchMock = jest
      .spyOn(service, 'fetchDeFiEnabledNetworks')
      .mockResolvedValue(['evm--1', 'evm--4663']);

    const staleResult = await service.getDeFiEnabledNetworksMapState();
    await waitForUpdate(1);
    await flushAsyncWork();

    expect(staleResult.enabledNetworksMap).toEqual({ 'evm--1': true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getStoredState().enabledNetworksMap).toEqual({
      'evm--1': true,
      'evm--4663': true,
    });
    expect(mockAppEventBus.emit).toHaveBeenCalledWith(
      'DeFiEnabledNetworksChanged',
      undefined,
    );
  });

  test('reuses the cached refresh result within five minutes', async () => {
    const { service, waitForUpdate } = makeService({
      enabledNetworksMap: { 'evm--1': true },
    });
    const fetchMock = jest
      .spyOn(service, 'fetchDeFiEnabledNetworks')
      .mockResolvedValue(['evm--1']);

    await service.getDeFiEnabledNetworksMapState();
    await waitForUpdate(1);
    await flushAsyncWork();
    await service.getDeFiEnabledNetworksMapState();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockAppEventBus.emit).not.toHaveBeenCalledWith(
      'DeFiEnabledNetworksChanged',
      undefined,
    );
  });

  test('refreshes on the next read after expiry and applies a removed network', async () => {
    const { getStoredState, service, waitForUpdate } = makeService({
      enabledNetworksMap: {
        'evm--1': true,
        'evm--4663': true,
      },
    });
    const fetchMock = jest
      .spyOn(service, 'fetchDeFiEnabledNetworks')
      .mockResolvedValueOnce(['evm--1', 'evm--4663'])
      .mockResolvedValue(['evm--1']);

    await service.getDeFiEnabledNetworksMapState();
    await waitForUpdate(1);
    await flushAsyncWork();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await service.getDeFiEnabledNetworksMapState();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await waitForUpdate(2);
    await flushAsyncWork();

    expect(getStoredState().enabledNetworksMap).toEqual({ 'evm--1': true });
    expect(mockAppEventBus.emit).toHaveBeenCalledWith(
      'DeFiEnabledNetworksChanged',
      undefined,
    );
  });

  test('keeps stale config when refresh fails', async () => {
    const { getStoredState, service } = makeService({
      enabledNetworksMap: { 'evm--1': true },
    });
    let resolveErrorLogged: (() => void) | undefined;
    const errorLogged = new Promise<void>((resolve) => {
      resolveErrorLogged = resolve;
    });
    jest
      .spyOn(service, 'fetchDeFiEnabledNetworks')
      .mockRejectedValue(new Error('mock network failure'));
    jest.spyOn(console, 'error').mockImplementation(() => {
      resolveErrorLogged?.();
    });

    const result = await service.getDeFiEnabledNetworksMapState();
    await errorLogged;

    expect(result.enabledNetworksMap).toEqual({ 'evm--1': true });
    expect(getStoredState().enabledNetworksMap).toEqual({ 'evm--1': true });
    expect(mockAppEventBus.emit).not.toHaveBeenCalledWith(
      'DeFiEnabledNetworksChanged',
      undefined,
    );
  });
});
