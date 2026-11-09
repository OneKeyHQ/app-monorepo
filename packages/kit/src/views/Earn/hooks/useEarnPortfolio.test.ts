/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import type {
  IEarnInvestmentItemV2,
  IEarnPortfolioInvestment,
} from '@onekeyhq/shared/types/staking';

import { useEarnPortfolio } from './useEarnPortfolio';

const mockStaking = {
  getAvailableAssetsV2: jest.fn(),
  getEarnAvailableAccountsParams: jest.fn(),
  fetchInvestmentBatchDetail: jest.fn(),
  fetchInvestmentDetailV2: jest.fn(),
  fetchAirdropInvestmentDetail: jest.fn(),
};
const mockCache: Record<string, IEarnPortfolioInvestment[]> = {};
const mockSetCache = jest.fn();
const mockActions = {
  current: { getEarnAccount: jest.fn(), updateEarnAccounts: jest.fn() },
};

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    get serviceStaking() {
      return mockStaking;
    },
  },
}));
jest.mock('@onekeyhq/shared/src/config/networkIds', () => ({
  getNetworkIdsMap: () => ({ onekeyall: 'onekeyall' }),
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { AccountDataUpdate: 'AccountDataUpdate' },
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));
jest.mock('@onekeyhq/shared/types/earn/earnProvider.constants', () => ({
  earnTestnetNetworkIds: [],
}));
jest.mock('../../../hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(),
}));
jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: { account: { id: 'account' } } }),
}));
jest.mock('../../../states/jotai/contexts/earn', () => ({
  useEarnActions: () => mockActions,
  useEarnAtom: () => [{}],
  useEarnPortfolioInvestmentsAtom: () => [mockCache, mockSetCache],
}));
jest.mock('./useEarnAccountKey', () => ({
  useEarnAccountKey: () => 'account',
}));

function investment(
  vault: string | undefined,
  totalFiatValue = '10',
): IEarnInvestmentItemV2 {
  return {
    protocol: {
      symbol: 'sUSDe',
      vault,
      providerDetail: { code: 'pendle', name: 'Pendle', logoURI: '' },
    },
    network: { networkId: 'evm--1', name: 'Ethereum', logoURI: '' },
    totalFiatValue,
    earnings24hFiatValue: '0',
    assets: [
      {
        token: { info: { symbol: 'sUSDe', logoURI: '' } },
        deposit: {
          title: { text: 'Deposit' },
          description: { text: totalFiatValue },
        },
        earnings24h: { title: { text: 'Earnings' } },
        rewardAssets: [],
        assetsStatus: [],
        buttons: [],
      },
    ],
  };
}

const assets = ['market-a', 'market-b'].map((vault) => ({
  type: 'normal',
  networkId: 'evm--1',
  provider: 'pendle',
  symbol: 'sUSDe',
  vault,
  enableBatch: true,
}));

describe('useEarnPortfolio batch refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete mockCache.account;
    mockStaking.getAvailableAssetsV2.mockResolvedValue(assets);
    mockStaking.getEarnAvailableAccountsParams.mockResolvedValue([
      { networkId: 'evm--1', accountAddress: 'address' },
    ]);
    mockStaking.fetchInvestmentBatchDetail.mockResolvedValue({
      items: [investment('market-a'), investment('market-b')],
      errors: [],
    });
  });

  it('fetches same-symbol vaults through one batch and no single-detail requests', async () => {
    const { result } = renderHook(() => useEarnPortfolio());
    await act(async () => result.current.refresh());
    expect(mockStaking.fetchInvestmentBatchDetail).toHaveBeenCalledTimes(1);
    expect(mockStaking.fetchInvestmentDetailV2).not.toHaveBeenCalled();
    expect(result.current.earnTotalFiatValue.toFixed()).toBe('20');
  });

  it('updates and clears the same EVM vault across mixed-case full and partial refreshes', async () => {
    const vaults = [
      '0xAbCd000000000000000000000000000000000001',
      '0xAbCd000000000000000000000000000000000002',
    ];
    mockStaking.getAvailableAssetsV2.mockResolvedValue(
      assets.map((asset, index) => ({ ...asset, vault: vaults[index] })),
    );
    mockStaking.fetchInvestmentBatchDetail.mockResolvedValueOnce({
      items: [
        investment(vaults[1].toLowerCase(), '20'),
        investment(vaults[0].toLowerCase(), '10'),
      ],
      errors: [],
    });

    const { result } = renderHook(() => useEarnPortfolio());
    await act(async () => result.current.refresh());
    expect(result.current.earnTotalFiatValue.toFixed()).toBe('30');
    expect(
      result.current.investments.flatMap((item) => item.assets),
    ).toHaveLength(2);

    mockStaking.fetchInvestmentBatchDetail.mockResolvedValueOnce({
      items: [investment(vaults[0], '15'), investment(vaults[1], '22')],
      errors: [],
    });
    await act(async () => result.current.refresh({ provider: 'pendle' }));
    expect(result.current.earnTotalFiatValue.toFixed()).toBe('37');
    expect(
      result.current.investments.flatMap((item) => item.assets),
    ).toHaveLength(2);

    mockStaking.fetchInvestmentBatchDetail.mockResolvedValueOnce({
      items: [
        investment(vaults[0].toLowerCase(), '0'),
        investment(vaults[1].toLowerCase(), '25'),
      ],
      errors: [],
    });
    await act(async () => result.current.refresh());
    expect(result.current.earnTotalFiatValue.toFixed()).toBe('25');
    expect(
      result.current.investments.flatMap((item) => item.assets),
    ).toHaveLength(1);
    expect(mockStaking.fetchInvestmentDetailV2).not.toHaveBeenCalled();
  });

  it('hydrates mixed-case EVM cached vaults and replaces them after a failed refresh', async () => {
    const vault = '0xAbCd000000000000000000000000000000000001';
    const cached = investment(vault, '10');
    mockCache.account = [
      {
        ...cached,
        airdropAssets: [],
        assets: cached.assets.map((asset) => ({
          ...asset,
          metadata: { protocol: cached.protocol, network: cached.network },
        })),
      },
    ];
    mockStaking.getAvailableAssetsV2.mockResolvedValue([
      { ...assets[0], vault: vault.toLowerCase() },
    ]);
    mockStaking.fetchInvestmentBatchDetail.mockResolvedValueOnce({
      items: [],
      errors: [
        { symbol: 'sUSDe', vault: vault.toLowerCase(), errorCode: 'TIMEOUT' },
      ],
    });

    const { result } = renderHook(() => useEarnPortfolio());
    await act(async () => result.current.refresh());
    expect(result.current.earnTotalFiatValue.toFixed()).toBe('10');

    mockStaking.fetchInvestmentBatchDetail.mockResolvedValueOnce({
      items: [investment(vault.toLowerCase(), '15')],
      errors: [],
    });
    await act(async () => result.current.refresh({ provider: 'pendle' }));
    expect(result.current.earnTotalFiatValue.toFixed()).toBe('15');
    expect(
      result.current.investments.flatMap((item) => item.assets),
    ).toHaveLength(1);
  });

  it.each([
    {
      items: [investment('market-a', '15')],
      errors: [{ symbol: 'sUSDe', vault: 'market-b', errorCode: 'TIMEOUT' }],
    },
    {
      items: [investment('market-a', '15'), investment(undefined, '99')],
      errors: [],
    },
  ])(
    'preserves unconfirmed vaults after a partial batch response: %j',
    async (response) => {
      const { result } = renderHook(() => useEarnPortfolio());
      await act(async () => result.current.refresh());
      mockStaking.fetchInvestmentBatchDetail.mockResolvedValueOnce(response);
      await act(async () => result.current.refresh());
      expect(result.current.earnTotalFiatValue.toFixed()).toBe('25');
      expect(mockStaking.fetchInvestmentDetailV2).not.toHaveBeenCalled();
    },
  );

  it.each(['full', 'partial'] as const)(
    'removes a missing Pendle vault after a successful %s refresh',
    async (scope) => {
      const { result } = renderHook(() => useEarnPortfolio());
      await act(async () => result.current.refresh());
      mockStaking.fetchInvestmentBatchDetail.mockResolvedValueOnce({
        items: [investment('market-a', '15')],
        errors: [],
      });
      await act(async () =>
        result.current.refresh(
          scope === 'partial' ? { provider: 'pendle' } : undefined,
        ),
      );
      expect(result.current.earnTotalFiatValue.toFixed()).toBe('15');
      expect(
        result.current.investments.flatMap((item) =>
          item.assets.map((asset) => asset.metadata?.protocol.vault),
        ),
      ).toEqual(['market-a']);
      expect(mockStaking.fetchInvestmentDetailV2).not.toHaveBeenCalled();
    },
  );

  it('retains existing positions if the batch request fails', async () => {
    const { result } = renderHook(() => useEarnPortfolio());
    await act(async () => result.current.refresh());
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      mockStaking.fetchInvestmentBatchDetail.mockRejectedValueOnce(
        new Error('request failed'),
      );
      await act(async () => result.current.refresh());
      expect(result.current.earnTotalFiatValue.toFixed()).toBe('20');
    } finally {
      warn.mockRestore();
    }
  });

  it('retains a vault when a returned item has the same vault but a different symbol', async () => {
    const { result } = renderHook(() => useEarnPortfolio());
    await act(async () => result.current.refresh());
    const mismatched = investment('market-b');
    mismatched.protocol.symbol = 'other';
    mockStaking.fetchInvestmentBatchDetail.mockResolvedValueOnce({
      items: [investment('market-a', '15'), mismatched],
      errors: [],
    });
    await act(async () => result.current.refresh());
    expect(result.current.earnTotalFiatValue.toFixed()).toBe('25');
  });

  it('clears Pendle positions when the successful batch is empty', async () => {
    const { result } = renderHook(() => useEarnPortfolio());
    await act(async () => result.current.refresh());
    mockStaking.fetchInvestmentBatchDetail.mockResolvedValueOnce({
      items: [],
      errors: [],
    });
    await act(async () => result.current.refresh());
    expect(result.current.earnTotalFiatValue.toFixed()).toBe('0');
    expect(result.current.investments).toHaveLength(0);
  });

  it('keeps missing positions for other providers', async () => {
    const morpho = (vault: string, value = '10') => {
      const item = investment(vault, value);
      return {
        ...item,
        protocol: {
          ...item.protocol,
          providerDetail: { ...item.protocol.providerDetail, code: 'morpho' },
        },
      };
    };
    mockStaking.getAvailableAssetsV2.mockResolvedValue(
      assets.map((asset) => ({ ...asset, provider: 'morpho' })),
    );
    mockStaking.fetchInvestmentBatchDetail
      .mockResolvedValueOnce({
        items: [morpho('market-a'), morpho('market-b')],
        errors: [],
      })
      .mockResolvedValueOnce({ items: [morpho('market-a', '15')], errors: [] });
    const { result } = renderHook(() => useEarnPortfolio());
    await act(async () => result.current.refresh());
    await act(async () => result.current.refresh());
    expect(result.current.earnTotalFiatValue.toFixed()).toBe('25');
  });

  it('keeps airdrop assets when the corresponding normal position disappears', async () => {
    const normal = investment('market-a');
    mockStaking.getAvailableAssetsV2.mockResolvedValue([
      assets[0],
      { ...assets[0], type: 'airdrop' },
    ]);
    mockStaking.fetchInvestmentBatchDetail
      .mockResolvedValueOnce({ items: [normal], errors: [] })
      .mockResolvedValueOnce({ items: [], errors: [] });
    mockStaking.fetchAirdropInvestmentDetail.mockResolvedValue({
      totalFiatValue: '1',
      protocol: normal.protocol,
      network: normal.network,
      assets: [
        {
          token: normal.assets[0].token,
          airdropAssets: [{ title: { text: 'Claimable' } }],
        },
      ],
    });
    const { result } = renderHook(() => useEarnPortfolio());
    await act(async () => result.current.refresh());
    await act(async () => result.current.refresh());
    expect(result.current.earnTotalFiatValue.toFixed()).toBe('0');
    expect(result.current.investments).toHaveLength(1);
    expect(result.current.investments[0].assets).toHaveLength(0);
    expect(result.current.investments[0].airdropAssets).toHaveLength(1);
  });

  it('removes a vault only when a matching successful response confirms zero', async () => {
    const { result } = renderHook(() => useEarnPortfolio());
    await act(async () => result.current.refresh());
    mockStaking.fetchInvestmentBatchDetail.mockResolvedValueOnce({
      items: [investment('market-a', '0'), investment('market-b', '15')],
      errors: [],
    });
    await act(async () => result.current.refresh());
    expect(result.current.earnTotalFiatValue.toFixed()).toBe('15');
    expect(
      result.current.investments
        .flatMap((item) => item.assets)
        .map((asset) => asset.metadata?.protocol.vault),
    ).toEqual(['market-b']);
  });
});
