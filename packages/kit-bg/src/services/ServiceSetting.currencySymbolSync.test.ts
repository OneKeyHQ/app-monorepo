/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return */

const mockSettingsPersistAtom = {
  get: jest.fn(),
  set: jest.fn(),
};
const mockCurrencyPersistAtom = {
  get: jest.fn(),
  set: jest.fn(),
};

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  function createLoggerProxy(): any {
    return new Proxy(jest.fn(), {
      get: () => createLoggerProxy(),
    });
  }
  return { defaultLogger: createLoggerProxy() };
});

jest.mock('../states/jotai/atoms/prime', () => ({
  primePersistAtom: { get: jest.fn() },
}));

jest.mock('../states/jotai/atoms/settings', () => ({
  settingsPersistAtom: mockSettingsPersistAtom,
  settingsFiatPaySiteWhitelistPersistAtom: {},
  settingsLastActivityAtom: {},
}));

jest.mock('../states/jotai/atoms', () => ({
  currencyPersistAtom: mockCurrencyPersistAtom,
  desktopBluetoothAtom: {},
}));

jest.mock('../states/jotai/atoms/devSettings', () => ({
  devSettingsPersistAtom: { get: jest.fn(), set: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/appApiClient/appApiClient', () => ({
  appApiClient: {
    getClient: jest.fn(),
    getRawDataClient: jest.fn(),
  },
}));

jest.mock('../endpoints', () => ({
  getEndpointInfo: jest.fn(),
}));

const ServiceSetting = require('./ServiceSetting')
  .default as typeof import('./ServiceSetting').default;

const SERVER_CURRENCY_MAP = {
  usd: {
    id: 'usd',
    name: 'US Dollar',
    unit: '$',
    type: ['fiat', 'popular'],
    value: '1',
  },
  cny: {
    id: 'cny',
    name: 'Chinese Yuan',
    unit: '¥',
    type: ['fiat'],
    value: '7.2',
  },
};

function createService({
  currencyInfo,
}: {
  currencyInfo: { id: string; symbol: string };
}) {
  let settingsState: any = { currencyInfo };

  mockSettingsPersistAtom.get.mockImplementation(async () => settingsState);
  mockSettingsPersistAtom.set.mockImplementation(
    async (builder: (value: any) => any) => {
      settingsState = builder(settingsState);
      return settingsState;
    },
  );
  mockCurrencyPersistAtom.set.mockImplementation(async () => {});

  const backgroundApi = {
    simpleDb: {
      appStatus: { getRawData: jest.fn(), setRawData: jest.fn() },
    },
  };
  const service = new ServiceSetting({ backgroundApi } as any);
  (service as any)._getCurrencyMap = jest.fn(async () => SERVER_CURRENCY_MAP);

  return {
    service,
    getSettingsState: () => settingsState,
  };
}

describe('ServiceSetting currency symbol self-heal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('heals a stale persisted symbol from the refreshed currency map', async () => {
    const { service, getSettingsState } = createService({
      currencyInfo: { id: 'usd', symbol: 'US$' },
    });

    await service.fetchCurrencyList();

    expect(mockCurrencyPersistAtom.set).toHaveBeenCalledWith({
      currencyMap: SERVER_CURRENCY_MAP,
    });
    expect(getSettingsState().currencyInfo).toEqual({
      id: 'usd',
      symbol: '$',
    });
  });

  it('does not rewrite settings when the symbol already matches', async () => {
    const { service, getSettingsState } = createService({
      currencyInfo: { id: 'usd', symbol: '$' },
    });

    await service.fetchCurrencyList();

    expect(mockSettingsPersistAtom.set).not.toHaveBeenCalled();
    expect(getSettingsState().currencyInfo).toEqual({
      id: 'usd',
      symbol: '$',
    });
  });

  it('keeps the snapshot when the selected currency is missing from the map', async () => {
    const { service, getSettingsState } = createService({
      currencyInfo: { id: 'vef', symbol: 'Bs.F' },
    });

    await service.fetchCurrencyList();

    expect(mockSettingsPersistAtom.set).not.toHaveBeenCalled();
    expect(getSettingsState().currencyInfo).toEqual({
      id: 'vef',
      symbol: 'Bs.F',
    });
  });

  it('skips the heal write when the currency changed concurrently', async () => {
    const { service, getSettingsState } = createService({
      currencyInfo: { id: 'cny', symbol: '¥' },
    });
    // Simulate a concurrent setCurrency: the read sees a stale usd snapshot
    // while the persisted state has already moved on to cny.
    mockSettingsPersistAtom.get.mockResolvedValueOnce({
      currencyInfo: { id: 'usd', symbol: 'US$' },
    });

    await service.fetchCurrencyList();

    expect(getSettingsState().currencyInfo).toEqual({
      id: 'cny',
      symbol: '¥',
    });
  });
});
