import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import ServiceNetwork from './ServiceNetwork';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: unknown, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () => (_target: unknown, _key: unknown, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('../ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

jest.mock('p-limit', () => () => (fn: () => unknown) => fn());

const zcash = { id: 'zec--0', name: 'Zcash' } as IServerNetwork;
const ethereum = { id: 'evm--1', name: 'Ethereum' } as IServerNetwork;
const testnet = { id: 'tbtc--0', name: 'Bitcoin Testnet' } as IServerNetwork;

function buildService() {
  const getVaultSettings = jest.fn(
    async ({ networkId }: { networkId: string }) => {
      if (networkId.startsWith('starknet--')) {
        throw new OneKeyLocalError('no settings found: impl=starknet');
      }
      return {
        accountDeriveInfo: { default: {} },
      };
    },
  );
  const service = new ServiceNetwork({
    backgroundApi: {
      simpleDb: {
        accountSelector: { getRawData: jest.fn(async () => ({})) },
      },
      serviceNetwork: {
        getGlobalDeriveTypeOfNetwork: jest.fn(async () => 'default'),
        getVaultSettings,
      },
    },
  });
  return { service, getVaultSettings };
}

function selectorNetworks() {
  return {
    mainnetItems: [zcash],
    testnetItems: [] as IServerNetwork[],
    frequentlyUsedItems: [] as IServerNetwork[],
    unavailableItems: [] as IServerNetwork[],
  };
}

describe('ServiceNetwork.sortChainSelectorNetworksByValue', () => {
  it('keeps Zcash selectable when persisted balances include a removed chain', async () => {
    const { service, getVaultSettings } = buildService();
    const networks = selectorNetworks();

    const result = await service.sortChainSelectorNetworksByValue({
      walletId: 'hd-test',
      chainSelectorNetworks: networks,
      accountNetworkValues: {
        'hd-test--account_starknet--removed': '1000',
        'hd-test--account_zec--0': '20',
      },
      localDeFiOverview: {},
    });

    expect(result.chainSelectorNetworks.mainnetItems).toEqual([zcash]);
    expect(result.chainSelectorNetworks.frequentlyUsedItems).toEqual([zcash]);
    expect(result.formattedAccountNetworkValues).toEqual({ 'zec--0': '20' });
    expect(getVaultSettings).toHaveBeenCalledTimes(1);
    expect(getVaultSettings).toHaveBeenCalledWith({ networkId: zcash.id });
  });

  it('does not load settings for balances outside a restricted network list', async () => {
    const { service, getVaultSettings } = buildService();

    const result = await service.sortChainSelectorNetworksByValue({
      walletId: 'hd-test',
      chainSelectorNetworks: selectorNetworks(),
      accountNetworkValues: {
        'hd-test--account_evm--1': '1000',
        'hd-test--account_zec--0': '20',
      },
      localDeFiOverview: {},
    });

    expect(result.chainSelectorNetworks.frequentlyUsedItems).toEqual([zcash]);
    expect(result.formattedAccountNetworkValues).toEqual({ 'zec--0': '20' });
    expect(getVaultSettings).toHaveBeenCalledTimes(1);
    expect(getVaultSettings).toHaveBeenCalledWith({ networkId: zcash.id });
  });

  it('preserves supported balances for testnets and unavailable networks', async () => {
    const { service } = buildService();
    const networks = {
      ...selectorNetworks(),
      testnetItems: [testnet],
      unavailableItems: [ethereum],
    };

    const result = await service.sortChainSelectorNetworksByValue({
      walletId: 'hd-test',
      chainSelectorNetworks: networks,
      accountNetworkValues: {
        'hd-test--account_zec--0': '20',
        'hd-test--account_tbtc--0': '3',
        'hd-test--account_evm--1': '5',
      },
      localDeFiOverview: {},
    });

    expect(result.chainSelectorNetworks.testnetItems).toEqual([testnet]);
    expect(result.chainSelectorNetworks.unavailableItems).toEqual([ethereum]);
    expect(result.formattedAccountNetworkValues).toEqual({
      'zec--0': '20',
      'tbtc--0': '3',
      'evm--1': '5',
    });
  });
});
