/** @jest-environment jsdom */

import { render } from '@testing-library/react';

import type { IStakeProtocolDetails } from '@onekeyhq/shared/types/staking';

import { FaqSection } from './FaqSection';

const mockGetFAQList = jest
  .fn<Promise<unknown[]>, [unknown]>()
  .mockResolvedValue([]);

jest.mock('@onekeyhq/components', () => ({}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getFAQList: (params: unknown) => mockGetFAQList(params),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/components/HyperlinkText', () => ({}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (load: () => Promise<unknown>) => {
    void load();
    return { result: [] };
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useUserWalletProfile', () => ({}));
jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector',
  () => ({}),
);

const details: IStakeProtocolDetails = {
  staked: '0',
  stakedFiatValue: '0',
  available: '0',
  updateFrequency: '',
  rewardToken: '',
  provider: {
    name: 'morpho',
    logoURI: '',
    website: '',
    poolFee: '0',
    rewardUnit: 'APY',
    totalStaked: '0',
    totalStakedFiatValue: '0',
    totalFiatValue: '0',
    minStakeAmount: '0',
    maxStakeAmount: '0',
    buttonStake: true,
    buttonUnstake: true,
    alerts: [],
  },
  token: {
    balance: '0',
    balanceParsed: '0',
    fiatValue: '0',
    price: '0',
    price24h: '0',
    info: {
      name: 'Receipt',
      symbol: 'receipt',
      address: '0x1',
      decimals: 18,
      isNative: false,
    },
  },
};

describe('Earn FAQ identity', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['etherfi', 'entry-token'],
    ['morpho', 'receipt'],
    ['pendle', 'receipt'],
  ])('uses the correct FAQ symbol for %s', (provider, symbol) => {
    render(
      <FaqSection
        details={{
          ...details,
          provider: { ...details.provider, name: provider },
        }}
        symbol="entry-token"
      />,
    );
    expect(mockGetFAQList).toHaveBeenCalledWith({ provider, symbol });
  });
});
