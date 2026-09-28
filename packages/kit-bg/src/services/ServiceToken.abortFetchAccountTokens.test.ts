/*
yarn jest packages/kit-bg/src/services/ServiceToken.abortFetchAccountTokens.test.ts

An enabled-network change under All Networks supersedes the home token list's
running fan-out and aborts its requests. That abort must reach only the
fan-out's own `home-token-list` All Networks requests: a token selector,
universal search or portfolio read running at the same time keeps its result.
*/

// --- jest.mock calls are hoisted above these imports by babel-jest ---

import ServiceToken from './ServiceToken';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
  backgroundMethodForDev:
    () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
      d,
  toastIfError: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) => d,
  checkDevOnlyPassword: jest.fn(),
}));

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: any;

    constructor({ backgroundApi }: { backgroundApi: any }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    MemoryPressureWarning: 'MemoryPressureWarning',
  },
  appEventBus: {
    on: jest.fn(),
  },
}));

jest.mock('../states/jotai/atoms', () => ({
  settingsPersistAtom: {
    get: jest.fn(async () => ({ currencyInfo: { id: 'usd' } })),
  },
  currencyPersistAtom: {
    get: jest.fn(async () => ({ currencyMap: {} })),
  },
}));

jest.mock('../vaults/factory', () => ({
  vaultFactory: { getVault: jest.fn() },
}));

jest.mock('../vaults/settings', () => ({
  getVaultSettings: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { token: { request: {} } },
}));

type IRequest = { flag?: string; isAllNetworks?: boolean };

function setup(requests: Record<string, IRequest>) {
  const service = new ServiceToken({ backgroundApi: {} });
  const controllers = Object.fromEntries(
    Object.keys(requests).map((name) => [name, new AbortController()]),
  );
  Object.entries(requests).forEach(([name, request]) => {
    service._fetchAccountTokensControllers.push({
      controller: controllers[name],
      ...request,
    });
  });
  const aborted = () =>
    Object.keys(controllers)
      .filter((name) => controllers[name].signal.aborted)
      .sort();
  return { service, aborted };
}

const IN_FLIGHT: Record<string, IRequest> = {
  homeAllNetworks: { flag: 'home-token-list', isAllNetworks: true },
  homeSingleNetwork: { flag: 'home-token-list', isAllNetworks: false },
  tokenSelector: { flag: 'token-selector', isAllNetworks: false },
  universalSearch: { flag: 'universal-search', isAllNetworks: false },
  perpsDeposit: { flag: 'perps-deposit-token-list', isAllNetworks: false },
  unflagged: {},
};

describe('ServiceToken.abortFetchAccountTokens', () => {
  it('aborts only the home All Networks fan-out when asked by flag and mode', async () => {
    const { service, aborted } = setup(IN_FLIGHT);

    await service.abortFetchAccountTokens({
      flags: ['home-token-list'],
      isAllNetworks: true,
    });

    expect(aborted()).toEqual(['homeAllNetworks']);
    // The survivors stay registered for a later abort.
    expect(service._fetchAccountTokensControllers).toHaveLength(5);
  });

  it('keeps aborting everything but the excluded flags for the refresh paths', async () => {
    const { service, aborted } = setup(IN_FLIGHT);

    await service.abortFetchAccountTokens({
      excludedFlags: ['token-selector'],
    });

    expect(aborted()).toEqual([
      'homeAllNetworks',
      'homeSingleNetwork',
      'perpsDeposit',
      'unflagged',
      'universalSearch',
    ]);
    expect(service._fetchAccountTokensControllers).toHaveLength(1);
  });

  it('aborts every request when called without options', async () => {
    const { service, aborted } = setup(IN_FLIGHT);

    await service.abortFetchAccountTokens();

    expect(aborted()).toEqual(Object.keys(IN_FLIGHT).toSorted());
    expect(service._fetchAccountTokensControllers).toHaveLength(0);
  });
});
