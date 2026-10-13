// TODO(OK-64624): dev-only mock for testing the payout history page. Remove
// this file and its call sites in ./index.tsx before merging.
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IInvitePaidHistory,
  IInviteSummary,
} from '@onekeyhq/shared/src/referralCode/type';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

// 'off' uses the real API. 'data' returns a long list, 'empty' no records,
// 'listError' / 'summaryError' fail that request.
type IMockMode = 'off' | 'data' | 'empty' | 'listError' | 'summaryError';
const MOCK_MODE: IMockMode = platformEnv.isDev ? 'data' : 'off';

// Slow on purpose so every open lands after the first frame, like the cold
// first open that froze the page.
const SUMMARY_DELAY_MS = 800;
const LIST_DELAY_MS = 1500;

const ARBITRUM_NETWORK_ID = 'evm--42161';
const USDC = {
  networkId: ARBITRUM_NETWORK_ID,
  address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
  logoURI: '',
  name: 'USD Coin',
  symbol: 'USDC',
};

const DAY_MS = 24 * 60 * 60 * 1000;

function buildItems(): IInvitePaidHistory['items'] {
  const now = Date.now();
  // [days ago, amount]; repeated days group into one section.
  const rows: Array<[number, string]> = [
    [0, '999'],
    [0, '12.5'],
    [0, '0.01'],
    [3, '122.1'],
    [9, '241.7758'],
    [9, '88'],
    [21, '4916.07'],
    [35, '185.4'],
    [35, '3.21'],
    [36, '76'],
    [50, '1234.5678'],
    [64, '42'],
    [80, '600'],
    [80, '7.7'],
    [95, '15'],
    [120, '320.45'],
    [150, '9.99'],
    [180, '2500'],
  ];
  return rows.map(([daysAgo, amount], index) => {
    const createdAt = new Date(now - daysAgo * DAY_MS - index).toISOString();
    return {
      _id: `mock-${index}`,
      networkId: ARBITRUM_NETWORK_ID,
      address: '0x2db7000000000000000000000000000000e73a42',
      token: USDC,
      version: 1,
      rebateAmount: amount,
      // The second row has no tx to show the '-' fallback.
      tx: index === 1 ? '' : `0x${index.toString(16).padStart(64, 'a')}`,
      updatedAt: createdAt,
      createdAt,
      paidAmount: amount,
    };
  });
}

export async function mockInvitePaidList(
  fetchReal: () => Promise<IInvitePaidHistory>,
): Promise<IInvitePaidHistory> {
  if (MOCK_MODE === 'off') {
    return fetchReal();
  }
  await timerUtils.wait(LIST_DELAY_MS);
  if (MOCK_MODE === 'listError') {
    throw new OneKeyLocalError('Mock payout list error');
  }
  const items = MOCK_MODE === 'empty' ? [] : buildItems();
  return { total: items.length, items };
}

export async function mockSummaryInfo(
  fetchReal: () => Promise<IInviteSummary>,
): Promise<IInviteSummary> {
  if (MOCK_MODE === 'off') {
    return fetchReal();
  }
  await timerUtils.wait(SUMMARY_DELAY_MS);
  if (MOCK_MODE === 'summaryError') {
    throw new OneKeyLocalError('Mock summary error');
  }
  // Keep the real summary so editing the address still works; only fill in
  // an address when none is bound.
  const summary = await fetchReal();
  if (summary.withdrawAddresses.length > 0) {
    return summary;
  }
  const now = new Date().toISOString();
  return {
    ...summary,
    withdrawAddresses: [
      {
        _id: 'mock-address',
        networkId: ARBITRUM_NETWORK_ID,
        userId: 'mock-user',
        __v: 0,
        address: '0x2db7000000000000000000000000000000e73a42',
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}
