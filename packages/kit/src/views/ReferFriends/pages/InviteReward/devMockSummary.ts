// DEV ONLY, remove before the PR: overlays mock earnings on the real
// summary so the invite page can be reviewed with data. Dev builds only.
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';

const USDC = {
  networkId: 'evm--42161',
  address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
  logoURI: '',
  name: 'USD Coin',
  symbol: 'USDC',
};

const reward = (usd: string) => [
  { token: USDC, amount: usd, fiatValue: usd, usdValue: usd },
];

export function applyDevMockSummary(summary: IInviteSummary): IInviteSummary {
  if (!platformEnv.isDev) {
    return summary;
  }
  return {
    ...summary,
    withdrawAddresses: summary.withdrawAddresses.length
      ? summary.withdrawAddresses
      : [
          {
            _id: 'mock',
            networkId: 'evm--42161',
            userId: 'mock',
            __v: 0,
            address: '0xf64888c2a6b44c3b1e8f0a8d1c5e2b7a9d39cedbe',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
    cumulativeRewards: {
      ...summary.cumulativeRewards,
      distributed: '3268.40',
      undistributed: '1551.50',
      pending: '320.00',
      nextDistribution: '2026-11-10T12:00:00.000Z',
    },
    HardwareSales: {
      ...summary.HardwareSales,
      monthlySales: '12',
      monthlySalesFiatValue: '18640.00',
      available: reward('892.30'),
      pending: reward('320.00'),
    },
    Perp: { ...summary.Perp, available: reward('436.75') },
    Onchain: {
      ...summary.Onchain,
      available: reward('104.20'),
      swap: reward('118.25'),
    },
  };
}
