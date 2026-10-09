import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IInviteSummary,
  IRewardToken,
} from '@onekeyhq/shared/src/referralCode/type';

// Dev-only preview data for the invite home, so the earnings card and
// "Earnings by product" can be reviewed without real referral rewards:
// hardware (with monthly sales and a pending payout), Perps and Swap carry
// balances, DeFi stays empty and shows as the folded "no reward" row.
// Turn off (or remove this file) before the branch merges.
export const INVITE_SUMMARY_MOCK_ENABLED = platformEnv.isDev;

const MOCK_USDC: IRewardToken = {
  networkId: 'evm--42161',
  address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
  logoURI: '',
  name: 'USD Coin',
  symbol: 'USDC',
};

function balance(amount: string) {
  return { token: MOCK_USDC, amount, fiatValue: amount, usdValue: amount };
}

// Keeps everything else from the real summary (code, link, level, payout
// address) and swaps in the reward figures. The unpaid total equals the sum
// of the product rows, as it does with real data.
export function withInviteSummaryMock(summary: IInviteSummary): IInviteSummary {
  return {
    ...summary,
    HardwareSales: {
      ...summary.HardwareSales,
      monthlySales: '3',
      monthlySalesFiatValue: '891.00',
      available: [balance('239.40')],
      pending: [balance('203.04')],
    },
    Perp: {
      ...summary.Perp,
      available: [balance('128.56')],
    },
    Onchain: {
      ...summary.Onchain,
      available: [],
      swap: [balance('42.10')],
    },
    cumulativeRewards: {
      ...summary.cumulativeRewards,
      undistributed: '410.06',
      distributed: '1250.00',
      pending: '203.04',
    },
  };
}
