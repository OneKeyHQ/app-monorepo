/* eslint-disable import/first */

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const serviceStaking = {
    fetchAirdropInvestmentDetail: jest.fn(),
    fetchInvestmentBatchDetail: jest.fn(),
    fetchInvestmentDetailV2: jest.fn(),
    getAvailableAssetsV2: jest.fn(),
    getEarnAvailableAccountsParams: jest.fn(),
  };

  (globalThis as any).__earnPortfolioStreamBackgroundMock = {
    serviceStaking,
  };

  return {
    __esModule: true,
    default: {
      serviceStaking,
    },
  };
});

import type { IEarnPortfolioInvestmentItemAsset } from '@onekeyhq/shared/types/staking';

import { createEarnPortfolioInvestmentKey } from './earnPortfolioShared';
import { streamEarnPortfolio } from './earnPortfolioStream';

const backgroundMock = (globalThis as any)
  .__earnPortfolioStreamBackgroundMock as {
  serviceStaking: {
    fetchAirdropInvestmentDetail: jest.Mock;
    fetchInvestmentBatchDetail: jest.Mock;
    fetchInvestmentDetailV2: jest.Mock;
    getAvailableAssetsV2: jest.Mock;
    getEarnAvailableAccountsParams: jest.Mock;
  };
};

function buildInvestmentItem({
  networkId = 'sol--101',
  provider = 'pendle',
  symbol,
  vault,
}: {
  networkId?: string;
  provider?: string;
  symbol: string;
  vault?: string;
}) {
  return {
    totalFiatValue: '100',
    totalFiatValueUsd: '100',
    earnings24hFiatValue: '1',
    protocol: {
      providerDetail: {
        code: provider,
        logoURI: '',
        name: provider,
      },
      symbol,
      vault,
    },
    assets: [
      {
        token: {
          info: {
            logoURI: '',
            symbol,
          },
        },
        deposit: {
          title: { text: '100' },
          description: { text: '100' },
        },
        earnings24h: {
          title: { text: '1' },
          description: { text: '1' },
        },
        rewardAssets: [],
        assetsStatus: [],
        buttons: [],
      } satisfies IEarnPortfolioInvestmentItemAsset,
    ],
    network: {
      networkId,
      name: 'Solana',
      logoURI: '',
    },
  };
}

describe('earnPortfolioStream', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    backgroundMock.serviceStaking.getEarnAvailableAccountsParams.mockResolvedValue(
      [
        {
          accountAddress: 'account-address',
          networkId: 'sol--101',
          publicKey: 'public-key',
        },
      ],
    );
  });

  it('routes ptAddress batch-enabled assets through single detail requests', async () => {
    backgroundMock.serviceStaking.getAvailableAssetsV2.mockResolvedValue([
      {
        type: 'normal',
        networkId: 'sol--101',
        provider: 'pendle',
        symbol: 'PT-USDe',
        vault: 'market-1',
        ptAddress: 'pt-address-1',
        enableBatch: true,
      },
    ]);
    backgroundMock.serviceStaking.fetchInvestmentDetailV2.mockResolvedValue(
      buildInvestmentItem({
        symbol: 'PT-USDe',
        vault: 'market-1',
      }),
    );

    await streamEarnPortfolio({
      accountId: 'account-id',
      networkId: 'sol--101',
      existingInvestments: [],
    });

    expect(
      backgroundMock.serviceStaking.fetchInvestmentBatchDetail,
    ).not.toHaveBeenCalled();
    expect(
      backgroundMock.serviceStaking.fetchInvestmentDetailV2,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        ptAddress: 'pt-address-1',
        symbol: 'PT-USDe',
        vault: 'market-1',
      }),
    );
  });

  it('keeps request-side vault when batch response omits the vault', async () => {
    const onPatches = jest.fn();

    backgroundMock.serviceStaking.getAvailableAssetsV2.mockResolvedValue([
      {
        type: 'normal',
        networkId: 'sol--101',
        provider: 'kamino',
        symbol: 'USDC',
        vault: 'vault-1',
        enableBatch: true,
      },
    ]);
    backgroundMock.serviceStaking.fetchInvestmentBatchDetail.mockResolvedValue({
      items: [
        buildInvestmentItem({
          provider: 'kamino',
          symbol: 'USDC',
          vault: undefined,
        }),
      ],
      errors: [],
    });

    await streamEarnPortfolio({
      accountId: 'account-id',
      networkId: 'sol--101',
      existingInvestments: [],
      onPatches,
    });

    expect(
      backgroundMock.serviceStaking.fetchInvestmentDetailV2,
    ).not.toHaveBeenCalled();
    expect(onPatches).toHaveBeenCalledWith([
      expect.objectContaining({
        key: createEarnPortfolioInvestmentKey({
          provider: 'kamino',
          symbol: 'USDC',
          vault: 'vault-1',
          networkId: 'sol--101',
        }),
      }),
    ]);
  });

  it('falls back to single detail requests when batch candidates share the same symbol', async () => {
    backgroundMock.serviceStaking.getAvailableAssetsV2.mockResolvedValue([
      {
        type: 'normal',
        networkId: 'sol--101',
        provider: 'pendle',
        symbol: 'sUSDe',
        vault: 'market-1',
        enableBatch: true,
      },
      {
        type: 'normal',
        networkId: 'sol--101',
        provider: 'pendle',
        symbol: 'sUSDe',
        vault: 'market-2',
        enableBatch: true,
      },
    ]);
    backgroundMock.serviceStaking.fetchInvestmentDetailV2.mockImplementation(
      async ({
        provider,
        symbol,
        vault,
      }: {
        provider: string;
        symbol: string;
        vault?: string;
      }) =>
        buildInvestmentItem({
          provider,
          symbol,
          vault,
        }),
    );

    await streamEarnPortfolio({
      accountId: 'account-id',
      networkId: 'sol--101',
      existingInvestments: [],
    });

    expect(
      backgroundMock.serviceStaking.fetchInvestmentBatchDetail,
    ).not.toHaveBeenCalled();
    expect(
      backgroundMock.serviceStaking.fetchInvestmentDetailV2,
    ).toHaveBeenCalledTimes(2);
    expect(
      backgroundMock.serviceStaking.fetchInvestmentDetailV2,
    ).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        symbol: 'sUSDe',
        vault: 'market-1',
      }),
    );
    expect(
      backgroundMock.serviceStaking.fetchInvestmentDetailV2,
    ).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        symbol: 'sUSDe',
        vault: 'market-2',
      }),
    );
  });
});
