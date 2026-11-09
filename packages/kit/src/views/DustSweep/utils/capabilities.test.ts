import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

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
  default: {},
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

describe('Dust Sweep network capabilities', () => {
  it('uses general Swap support without filtering by provider', () => {
    expect(
      getDustSweepSupportedNetworks([
        ethereum,
        bnb,
        { ...ethereum, networkId: 'unsupported', supportSingleSwap: false },
      ]),
    ).toEqual([ethereum, bnb]);
  });

  it('checks the current network against the same capability set', () => {
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
    expect(isDustSweepNetworkSupported({ isAllNetworks: true })).toBe(true);
  });

  it('loads the supported networks without provider settings', async () => {
    const fetchNetworks = jest.fn().mockResolvedValue([ethereum, bnb]);
    await expect(
      loadDustSweepEntryCapabilities(fetchNetworks),
    ).resolves.toEqual([ethereum, bnb]);
    expect(fetchNetworks).toHaveBeenCalledTimes(1);
  });

  it('suppresses the auto-toast when network capability loading fails', async () => {
    const error = Object.assign(new Error('Network capability read failed'), {
      autoToast: true,
    });
    const disableToast = jest.spyOn(errorToastUtils, 'toastIfErrorDisable');
    try {
      await expect(
        loadDustSweepEntryCapabilities(() => Promise.reject(error)),
      ).rejects.toBe(error);
      expect(disableToast).toHaveBeenCalledWith(error);
    } finally {
      disableToast.mockRestore();
    }
  });
});
