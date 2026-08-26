const mockPerpConstructor = jest.fn();
const mockGetPerpData = jest.fn(async () => ({ tradingUniverse: [] }));
let mockPerpModuleLoadCount = 0;
const mockCustomTokensConstructor = jest.fn();
let mockCustomTokensModuleLoadCount = 0;
const mockAppStatusConstructor = jest.fn();
const mockAppStatusStorageGetItem = jest.fn(async (key: string) => key);
const mockAppStatusGetRawData = jest.fn(async () => ({ ready: true }));
let mockAppStatusModuleLoadCount = 0;

jest.mock('../entity/SimpleDbEntityPerp', () => {
  mockPerpModuleLoadCount += 1;
  return {
    SimpleDbEntityPerp: jest.fn().mockImplementation(() => {
      mockPerpConstructor();
      return {
        getPerpData: mockGetPerpData,
      };
    }),
  };
});

jest.mock('../entity/SimpleDbEntityCustomTokens', () => {
  mockCustomTokensModuleLoadCount += 1;
  return {
    SimpleDbEntityCustomTokens: jest.fn().mockImplementation(() => {
      mockCustomTokensConstructor();
      return {};
    }),
  };
});

jest.mock('../entity/SimpleDbEntityAppStatus', () => {
  mockAppStatusModuleLoadCount += 1;
  return {
    SimpleDbEntityAppStatus: jest.fn().mockImplementation(() => {
      mockAppStatusConstructor();
      return {
        appStorage: {
          getItem: mockAppStatusStorageGetItem,
        },
        getRawData: mockAppStatusGetRawData,
      };
    }),
  };
});

describe('SimpleDb lazy entities', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockPerpModuleLoadCount = 0;
    mockCustomTokensModuleLoadCount = 0;
    mockAppStatusModuleLoadCount = 0;
  });

  test('keeps the perp API stable and loads one entity on concurrent use', async () => {
    const { SimpleDb } = await import('./SimpleDb');
    const simpleDb = new SimpleDb();

    const perp = simpleDb.perp;
    expect(simpleDb.perp).toBe(perp);
    expect(mockPerpModuleLoadCount).toBe(0);
    expect(mockPerpConstructor).not.toHaveBeenCalled();

    const [firstResult, secondResult] = await Promise.all([
      perp.getPerpData(),
      perp.getPerpData(),
    ]);

    expect(firstResult).toEqual({ tradingUniverse: [] });
    expect(secondResult).toEqual({ tradingUniverse: [] });
    expect(mockPerpModuleLoadCount).toBe(1);
    expect(mockPerpConstructor).toHaveBeenCalledTimes(1);
    expect(mockGetPerpData).toHaveBeenCalledTimes(2);
  });

  test('creates stable non-promise facades for every entity without loading them', async () => {
    const { SimpleDb } = await import('./SimpleDb');
    const simpleDb = new SimpleDb();
    const entityNames = Object.entries(
      Object.getOwnPropertyDescriptors(SimpleDb.prototype),
    )
      .filter(([, descriptor]) => typeof descriptor.get === 'function')
      .map(([name]) => name);

    expect(entityNames).toHaveLength(66);
    entityNames.forEach((entityName) => {
      const first = Reflect.get(simpleDb, entityName) as Record<
        PropertyKey,
        unknown
      >;
      expect(Reflect.get(simpleDb, entityName)).toBe(first);
      expect(first.then).toBeUndefined();
    });
    expect(mockPerpModuleLoadCount).toBe(0);
    expect(mockPerpConstructor).not.toHaveBeenCalled();
  });

  test('keeps legacy synchronous helpers on the facade without loading an entity', async () => {
    const { SimpleDb } = await import('./SimpleDb');
    const simpleDb = new SimpleDb();

    expect(
      simpleDb.customTokens.getXpubOrAddressFromAccountKey(
        'evm--1__account:0x1234',
      ),
    ).toBe('0x1234');
    expect(mockCustomTokensModuleLoadCount).toBe(0);
    expect(mockCustomTokensConstructor).not.toHaveBeenCalled();

    expect(simpleDb.appStatus.entityKey).toBe('simple_db_v5:appStatus');
    const entityStorage = simpleDb.appStatus.appStorage;
    expect(Reflect.get(entityStorage, 'flushGetRequests')).toBeUndefined();
    expect(mockAppStatusModuleLoadCount).toBe(0);
    expect(mockAppStatusConstructor).not.toHaveBeenCalled();

    const [storedKey, rawData] = await Promise.all([
      entityStorage.getItem(simpleDb.appStatus.entityKey),
      simpleDb.appStatus.getRawData(),
    ]);

    expect(storedKey).toBe('simple_db_v5:appStatus');
    expect(rawData).toEqual({ ready: true });
    expect(mockAppStatusModuleLoadCount).toBe(1);
    expect(mockAppStatusConstructor).toHaveBeenCalledTimes(1);
    expect(
      mockAppStatusStorageGetItem.mock.invocationCallOrder[0],
    ).toBeLessThan(mockAppStatusGetRawData.mock.invocationCallOrder[0]);
  });

  test('keeps the custom-token compatibility helper local on the UI proxy', async () => {
    const { SimpleDbProxy } = await import('./SimpleDbProxy');
    const callBackground = jest.fn(async () => undefined);
    const simpleDbProxy = new SimpleDbProxy({
      callBackground,
    } as unknown as ConstructorParameters<typeof SimpleDbProxy>[0]);

    expect(
      simpleDbProxy.customTokens.getXpubOrAddressFromAccountKey(
        'evm--1__account:0x1234',
      ),
    ).toBe('0x1234');
    expect(callBackground).not.toHaveBeenCalled();

    await simpleDbProxy.customTokens.getRawData();
    expect(callBackground).toHaveBeenCalledWith(
      'simpleDb@customTokens.getRawData',
    );
  });
});
