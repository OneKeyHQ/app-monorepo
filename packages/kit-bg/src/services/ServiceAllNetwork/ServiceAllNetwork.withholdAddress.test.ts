import ServiceAllNetwork from './ServiceAllNetwork';

import type { IAllNetworkAccountInfo } from './ServiceAllNetwork';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));
jest.mock('../ServiceBase', () => ({
  __esModule: true,
  default: class {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {},
  appEventBus: { on: jest.fn() },
}));

// Token search, approvals and All Networks history all build their backend
// account list here.
it('leaves chains that withhold their address out of the backend account list', async () => {
  const service = new ServiceAllNetwork({ backgroundApi: {} });
  jest.spyOn(service, 'getAllNetworkAccounts').mockResolvedValue({
    accountsInfo: [
      { networkId: 'btc--0', accountId: 'a1', apiAddress: 'bc1' },
      { networkId: 'xmr--0', accountId: 'a2', apiAddress: '4xmr' },
      { networkId: 'zec--0', accountId: 'a3', apiAddress: 't1zec' },
    ] as IAllNetworkAccountInfo[],
  } as Awaited<ReturnType<typeof service.getAllNetworkAccounts>>);

  const { allNetworkAccounts } =
    await service.buildAllNetworkAccountsForApiParam({
      accountId: 'hd-1--0',
      networkId: 'onekeyall--0',
    });

  expect(allNetworkAccounts.map((item) => item.networkId)).toEqual([
    'btc--0',
    'zec--0',
  ]);
  expect(JSON.stringify(allNetworkAccounts)).not.toContain('4xmr');
});
