/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return */

const mockSettingsPersistAtom = {
  get: jest.fn(),
  set: jest.fn(),
};
const mockInscriptionProtectionControlPersistAtom = {
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
  inscriptionProtectionControlPersistAtom:
    mockInscriptionProtectionControlPersistAtom,
  settingsPersistAtom: mockSettingsPersistAtom,
  settingsFiatPaySiteWhitelistPersistAtom: {},
  settingsLastActivityAtom: {},
}));

jest.mock('../states/jotai/atoms', () => ({
  currencyPersistAtom: {},
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

function createService({
  inscriptionProtection = true,
  inscriptionProtectionServerEnabled = true,
}: {
  inscriptionProtection?: boolean;
  inscriptionProtectionServerEnabled?: boolean;
} = {}) {
  let settingsState: { inscriptionProtection: boolean } = {
    inscriptionProtection,
  };
  let controlState = { enabled: inscriptionProtectionServerEnabled };
  const get = jest.fn();
  const service = new ServiceSetting({
    backgroundApi: {
      simpleDb: { appStatus: {} },
      serviceAccount: { getAccount: jest.fn() },
    },
  });

  mockSettingsPersistAtom.get.mockImplementation(async () => settingsState);
  mockSettingsPersistAtom.set.mockImplementation(
    async (builder: (value: typeof settingsState) => typeof settingsState) => {
      settingsState = builder(settingsState);
      return settingsState;
    },
  );
  mockInscriptionProtectionControlPersistAtom.get.mockImplementation(
    async () => controlState,
  );
  mockInscriptionProtectionControlPersistAtom.set.mockImplementation(
    async (builder: (value: typeof controlState) => typeof controlState) => {
      controlState = builder(controlState);
      return controlState;
    },
  );
  jest.spyOn(service, 'getClient').mockResolvedValue({ get } as never);

  return {
    get,
    getControlState: () => controlState,
    getSettingsState: () => settingsState,
    service,
  };
}

describe('ServiceSetting inscription protection control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists the server value without overwriting the user preference', async () => {
    const { get, getControlState, getSettingsState, service } = createService({
      inscriptionProtection: true,
      inscriptionProtectionServerEnabled: true,
    });
    get.mockResolvedValue({
      data: {
        data: [
          {
            key: 'BTC_INSCRIPTION_PROTECTION_ENABLED',
            value: '{"value":false}',
          },
        ],
      },
    });

    await service.fetchInscriptionProtectionControl();

    expect(get).toHaveBeenCalledWith('/utility/v1/setting', {
      params: { key: 'BTC_INSCRIPTION_PROTECTION_ENABLED' },
    });
    expect(getSettingsState()).toEqual({
      inscriptionProtection: true,
    });
    expect(getControlState()).toEqual({ enabled: false });
    expect(mockSettingsPersistAtom.set).not.toHaveBeenCalled();
  });

  it('keeps the control value isolated from UI settings snapshots', async () => {
    const { get, getControlState, service } = createService({
      inscriptionProtection: true,
      inscriptionProtectionServerEnabled: true,
    });
    get.mockResolvedValue({
      data: {
        data: [
          {
            key: 'BTC_INSCRIPTION_PROTECTION_ENABLED',
            value: '{"value":false}',
          },
        ],
      },
    });

    await service.fetchInscriptionProtectionControl();
    await mockSettingsPersistAtom.set(() => ({
      inscriptionProtection: false,
    }));

    expect(getControlState()).toEqual({ enabled: false });
  });

  it.each([
    ['a missing key', []],
    [
      'an invalid JSON value',
      [
        {
          key: 'BTC_INSCRIPTION_PROTECTION_ENABLED',
          value: 'invalid',
        },
      ],
    ],
    [
      'a non-boolean value',
      [
        {
          key: 'BTC_INSCRIPTION_PROTECTION_ENABLED',
          value: '{"value":"false"}',
        },
      ],
    ],
  ])('keeps the last valid value for %s', async (_label, data) => {
    const { get, getControlState, service } = createService({
      inscriptionProtectionServerEnabled: true,
    });
    get.mockResolvedValue({ data: { data } });

    await service.fetchInscriptionProtectionControl();

    expect(
      mockInscriptionProtectionControlPersistAtom.set,
    ).not.toHaveBeenCalled();
    expect(getControlState().enabled).toBe(true);
  });

  it('keeps the last valid value when the request fails', async () => {
    const { get, getControlState, service } = createService({
      inscriptionProtectionServerEnabled: false,
    });
    get.mockRejectedValue(new Error('network error'));

    await service.fetchInscriptionProtectionControl();

    expect(
      mockInscriptionProtectionControlPersistAtom.set,
    ).not.toHaveBeenCalled();
    expect(getControlState().enabled).toBe(false);
  });

  it('retries immediately after a failed request', async () => {
    const { get, getControlState, service } = createService({
      inscriptionProtectionServerEnabled: true,
    });
    get
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              key: 'BTC_INSCRIPTION_PROTECTION_ENABLED',
              value: '{"value":false}',
            },
          ],
        },
      });

    await service.fetchInscriptionProtectionControl();
    await service.fetchInscriptionProtectionControl();

    expect(get).toHaveBeenCalledTimes(2);
    expect(getControlState().enabled).toBe(false);
  });

  it.each([
    [true, true, true, true],
    [true, false, true, false],
    [false, true, true, false],
    [true, true, false, false],
  ])(
    'combines local=%s server=%s eligible=%s into %s',
    async (localEnabled, serverEnabled, eligible, expected) => {
      const { service } = createService({
        inscriptionProtection: localEnabled,
        inscriptionProtectionServerEnabled: serverEnabled,
      });
      jest
        .spyOn(service, 'checkInscriptionProtectionEnabled')
        .mockResolvedValue(eligible);

      await expect(
        service.getEffectiveInscriptionProtection({
          networkId: 'btc--0',
          accountId: 'account-id',
        }),
      ).resolves.toBe(expected);
    },
  );
});
