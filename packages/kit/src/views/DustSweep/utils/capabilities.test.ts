import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import type {
  ISwapProviderManager,
  ISwapServiceProvider,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

import { isDustSweepNetworkSupported } from '../hooks/useNavigateToDustSweep';

import {
  getDustSweepSupportedNetworks,
  loadDustSweepEntryCapabilities,
} from './loadNetworks';

jest.mock('@onekeyhq/components', () => ({}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    simpleDb: {
      swapConfigs: { getSwapProviderManager: jest.fn() },
    },
    serviceAllNetwork: {
      getAllNetworkAccounts: jest.fn(),
    },
    serviceSwap: {
      fetchSwapNetworks: jest.fn(),
      getSwapProviderManager: jest.fn(),
    },
    serviceToken: {
      fetchAccountTokens: jest.fn(),
      getNativeToken: jest.fn(),
    },
  },
}));
jest.mock('@onekeyhq/shared/src/config/networkIds', () => ({
  getNetworkIdsMap: () => ({ onekeyall: 'onekeyall--0' }),
}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  isExternalAccount: () => false,
  isWatchingAccount: () => false,
}));

const ethereum: ISwapNetwork = {
  networkId: 'evm--1',
  name: 'Ethereum',
  symbol: 'ETH',
  shortcode: 'eth',
  supportSingleSwap: true,
};
const bnb: ISwapNetwork = {
  ...ethereum,
  networkId: 'evm--56',
  name: 'BNB Smart Chain',
};

function okxProvider(
  overrides: Partial<ISwapServiceProvider> = {},
): ISwapServiceProvider {
  return {
    providerInfo: {
      provider: 'SwapOKX',
      protocol: EProtocolOfExchange.SWAP,
      logo: '',
      providerName: 'OKX Dex',
    },
    isSupportSingleSwap: true,
    supportSingleSwapNetworks: [ethereum],
    ...overrides,
  };
}

function deferred<T>() {
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((_, rejectPromise) => {
    reject = rejectPromise;
  });
  return { promise, reject };
}

describe('Dust Sweep network capabilities', () => {
  it('requires both general Swap support and OKX single-swap support', () => {
    expect(
      getDustSweepSupportedNetworks({
        networks: [ethereum, bnb],
        providers: [okxProvider()],
        savedProviders: [],
      }),
    ).toEqual([ethereum]);
    expect(
      getDustSweepSupportedNetworks({
        networks: [{ ...ethereum, supportSingleSwap: false }],
        providers: [okxProvider()],
        savedProviders: [],
      }),
    ).toEqual([]);
  });

  it.each<Partial<ISwapServiceProvider>>([
    { providerServiceDisable: true },
    { isSupportSingleSwap: false },
    { serviceDisableNetworks: [ethereum] },
    { supportSingleSwapNetworks: [] },
  ])('excludes disabled or unsupported provider networks (%j)', (overrides) => {
    expect(
      getDustSweepSupportedNetworks({
        networks: [ethereum],
        providers: [okxProvider(overrides)],
        savedProviders: [],
      }),
    ).toEqual([]);
  });

  it.each<Partial<ISwapProviderManager>>([
    { enable: false },
    { singleSwapEnable: false },
    { singleSwapDisableNetworks: [ethereum] },
    { disableNetworks: [ethereum] },
  ])('respects current and legacy saved Swap settings (%j)', (settings) => {
    expect(
      getDustSweepSupportedNetworks({
        networks: [ethereum],
        providers: [okxProvider()],
        savedProviders: [
          {
            providerInfo: okxProvider().providerInfo,
            enable: true,
            supportNetworks: [ethereum],
            ...settings,
          },
        ],
      }),
    ).toEqual([]);
  });

  it('preserves optional single-swap capability semantics', () => {
    expect(
      getDustSweepSupportedNetworks({
        networks: [ethereum],
        providers: [okxProvider({ isSupportSingleSwap: undefined })],
        savedProviders: [],
      }),
    ).toEqual([ethereum]);
  });

  it('does not substitute a different provider when OKX is unavailable', () => {
    const otherProvider = okxProvider();
    otherProvider.providerInfo.provider = 'OtherProvider';
    expect(
      getDustSweepSupportedNetworks({
        networks: [ethereum],
        providers: [otherProvider],
        savedProviders: [],
      }),
    ).toEqual([]);
  });

  it('keeps All Networks available when capabilities are unknown or empty', () => {
    for (const supportedNetworkIds of [undefined, new Set<string>()]) {
      expect(
        isDustSweepNetworkSupported({
          isAllNetworks: true,
          supportedNetworkIds,
        }),
      ).toBe(true);
      expect(
        isDustSweepNetworkSupported({
          networkId: ethereum.networkId,
          supportedNetworkIds,
        }),
      ).toBe(false);
    }
  });

  it('checks the current network against the same complete capability set', () => {
    const supportedNetworkIds = new Set([ethereum.networkId]);
    expect(
      isDustSweepNetworkSupported({
        networkId: ethereum.networkId,
        supportedNetworkIds,
      }),
    ).toBe(true);
    expect(
      isDustSweepNetworkSupported({
        networkId: bnb.networkId,
        supportedNetworkIds,
      }),
    ).toBe(false);
    expect(isDustSweepNetworkSupported({ supportedNetworkIds })).toBe(false);
  });
});

describe('optional Home capability loading', () => {
  it('returns the same supported networks from one group of capability reads', async () => {
    const fetchNetworks = jest.fn().mockResolvedValue([ethereum, bnb]);
    const fetchProviders = jest.fn().mockResolvedValue([okxProvider()]);
    const getSavedProviders = jest.fn().mockResolvedValue([]);
    await expect(
      loadDustSweepEntryCapabilities({
        fetchNetworks,
        fetchProviders,
        getSavedProviders,
      }),
    ).resolves.toEqual([ethereum]);
    expect(fetchNetworks).toHaveBeenCalledTimes(1);
    expect(fetchProviders).toHaveBeenCalledTimes(1);
    expect(getSavedProviders).toHaveBeenCalledTimes(1);
  });

  it('suppresses each auto-toast even when later branches fail after rejection', async () => {
    const networks = deferred<ISwapNetwork[]>();
    const providers = deferred<ISwapServiceProvider[]>();
    const savedProviders = deferred<ISwapProviderManager[]>();
    const errors = [0, 1, 2].map((index) =>
      Object.assign(new Error(`Capability read ${index} failed`), {
        autoToast: true,
      }),
    );
    const disableToast = jest.spyOn(errorToastUtils, 'toastIfErrorDisable');
    try {
      const result = loadDustSweepEntryCapabilities({
        fetchNetworks: () => networks.promise,
        fetchProviders: () => providers.promise,
        getSavedProviders: () => savedProviders.promise,
      });
      networks.reject(errors[0]);
      await expect(result).rejects.toBe(errors[0]);
      expect(errors[0].autoToast).toBe(false);

      providers.reject(errors[1]);
      savedProviders.reject(errors[2]);
      await Promise.resolve();
      for (const error of errors) {
        expect(error.autoToast).toBe(false);
        expect(disableToast).toHaveBeenCalledWith(error);
      }
    } finally {
      disableToast.mockRestore();
    }
  });
});
