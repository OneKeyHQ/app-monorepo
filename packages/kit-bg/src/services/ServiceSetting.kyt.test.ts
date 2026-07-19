/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return */

const mockPrimePersistAtom = {
  get: jest.fn(),
};
const mockSettingsPersistAtom = {
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
  primePersistAtom: mockPrimePersistAtom,
}));

jest.mock('../states/jotai/atoms/settings', () => ({
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

function createService() {
  let currentUserId = 'user-a';
  let authGeneration = 1;
  let settingsState = {
    receiveRiskMonitoringMap: {} as Record<string, boolean>,
  };
  let appStatusState = {};
  const getActiveAuthToken = jest.fn(async () => 'token-a');
  const getAuthStateGeneration = jest.fn(async () => authGeneration);
  const appStatus = {
    setRawData: jest.fn(async (builder: (value: any) => any) => {
      appStatusState = builder(appStatusState);
      return appStatusState;
    }),
  };
  const backgroundApi = {
    simpleDb: {
      appStatus,
      prime: { getActiveAuthToken, getAuthStateGeneration },
    },
  };

  mockPrimePersistAtom.get.mockImplementation(async () => ({
    onekeyUserId: currentUserId,
  }));
  mockSettingsPersistAtom.get.mockImplementation(async () => settingsState);
  mockSettingsPersistAtom.set.mockImplementation(
    async (builder: (value: typeof settingsState) => typeof settingsState) => {
      settingsState = builder(settingsState);
      return settingsState;
    },
  );

  const service = new ServiceSetting({ backgroundApi });
  const put = jest.fn();
  jest.spyOn(service, 'getOneKeyIdClient').mockResolvedValue({ put } as never);
  // Mirror ServiceBase.getOneKeyIdAuthHeaders without its lazy import of the
  // Supabase-backed primeAuthSessionAccess module (not loadable under jest).
  jest.spyOn(service, 'getOneKeyIdAuthHeaders').mockImplementation(async () => {
    const authToken = await getActiveAuthToken();
    const headers: Record<string, string> = authToken
      ? { 'X-Onekey-Request-Token': authToken }
      : {};
    return headers;
  });

  return {
    getActiveAuthToken,
    getSettingsState: () => settingsState,
    put,
    service,
    switchUser: (onekeyUserId: string) => {
      currentUserId = onekeyUserId;
      authGeneration += 1;
    },
  };
}

describe('ServiceSetting KYT user binding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('binds the request token and cache write to the target user', async () => {
    const { getSettingsState, put, service, switchUser } = createService();
    put.mockImplementation(async () => {
      switchUser('user-b');
      return { data: { data: { kytEnabled: true } } };
    });

    const result = await service.apiSetKytEnabled({
      enabled: true,
      onekeyUserId: 'user-a',
    });

    expect(put).toHaveBeenCalledWith(
      '/prime/v1/kyt/enabled',
      { enabled: true },
      { headers: { 'X-Onekey-Request-Token': 'token-a' } },
    );
    expect(getSettingsState().receiveRiskMonitoringMap).toEqual({
      'user-a': true,
    });
    expect(result).toEqual({
      applied: true,
      accountChanged: true,
      kytEnabled: true,
      onekeyUserId: 'user-a',
    });
  });

  it('does not send when auth changes while the token snapshot is captured', async () => {
    const { getActiveAuthToken, put, service, switchUser } = createService();
    getActiveAuthToken.mockImplementationOnce(async () => {
      switchUser('user-b');
      return 'token-a';
    });

    await expect(
      service.apiSetKytEnabled({
        enabled: true,
        onekeyUserId: 'user-a',
      }),
    ).resolves.toEqual({
      applied: false,
      accountChanged: true,
      onekeyUserId: 'user-a',
    });
    expect(put).not.toHaveBeenCalled();
  });

  it('keeps the action retryable when the active token is unavailable', async () => {
    const { getActiveAuthToken, put, service } = createService();
    getActiveAuthToken.mockResolvedValueOnce('');

    await expect(
      service.apiSetKytEnabled({
        enabled: true,
        onekeyUserId: 'user-a',
      }),
    ).rejects.toThrow('Prime auth token unavailable');
    expect(put).not.toHaveBeenCalled();
  });
});
