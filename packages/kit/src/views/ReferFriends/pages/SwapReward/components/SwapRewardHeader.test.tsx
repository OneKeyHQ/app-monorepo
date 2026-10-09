/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import type { IStatCardProps } from '@onekeyhq/kit/src/views/ReferFriends/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapCumulativeRewardsResponse } from '@onekeyhq/shared/src/referralCode/type';

import { SwapRewardHeader } from './SwapRewardHeader';

const mockCards: IStatCardProps[] = [];
const mockSummaries: Array<{
  title: string;
  hint?: string;
  rows?: Array<{ label: string; value: string; hint?: string }>;
}> = [];
const mockMedia = { lg: false, md: false };

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Stack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  YStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  useMedia: () => mockMedia,
}));

jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  useCurrency: () => ({ symbol: '$' }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useFormatDate', () => ({
  __esModule: true,
  default: () => ({
    format: () => 'Aug 1',
  }),
}));

jest.mock('@onekeyhq/kit/src/views/ReferFriends/components', () => ({
  RewardHeaderLayout: ({
    primaryCard,
    secondaryCards,
  }: {
    primaryCard: ReactNode;
    secondaryCards: ReactNode;
  }) => (
    <>
      {primaryCard}
      {secondaryCards}
    </>
  ),
  StatCard: (props: IStatCardProps) => {
    mockCards.push(props);
    return <div />;
  },
  RewardSummaryCard: (props: (typeof mockSummaries)[number]) => {
    mockSummaries.push(props);
    return <div />;
  },
}));

const data: ISwapCumulativeRewardsResponse = {
  pendingReward: '1',
  pendingRewardFiatValue: '1',
  undistributedReward: '2',
  undistributedRewardFiatValue: '2',
  totalReward: '3',
  totalRewardFiatValue: '3',
  totalVolume: '10',
  totalVolumeFiatValue: '10',
  totalFee: '1',
  totalFeeFiatValue: '1',
  invitedAddresses: 1,
  walletCount: 1,
  nextDistribution: '2026-08-01',
  token: {
    networkId: 'evm--1',
    address: '0xtoken',
    logoURI: 'https://example.com/token.png',
    name: 'USD Coin',
    symbol: 'USDC',
  },
};

describe('SwapRewardHeader', () => {
  beforeEach(() => {
    mockCards.length = 0;
    mockSummaries.length = 0;
    mockMedia.lg = false;
    mockMedia.md = false;
  });

  it('renders only the three Perps-style summary cards on wide screens', () => {
    render(<SwapRewardHeader data={data} />);

    const undistributedCard = mockCards.find(
      (card) => card.title === ETranslations.referral_undistributed,
    );

    expect(mockCards.map((card) => card.title)).toEqual([
      ETranslations.referral_undistributed,
      ETranslations.referral_perps_volume,
      ETranslations.referral_perps_invited_addresses,
    ]);
    expect(undistributedCard?.subtitle).toContain(
      `${ETranslations.referral_perps_total}: $3.00`,
    );
    expect(undistributedCard?.subtitle).toContain('Next payout Aug 1');
  });

  it('sums the figures up in one card on mobile', () => {
    mockMedia.lg = true;
    mockMedia.md = true;

    render(<SwapRewardHeader data={data} />);

    expect(mockCards).toHaveLength(0);
    expect(mockSummaries).toHaveLength(1);
    const [summary] = mockSummaries;
    expect(summary.title).toBe(ETranslations.referral_undistributed);
    expect(summary.hint).toBe('Next payout Aug 1');
    expect(summary.rows?.map((row) => row.label)).toEqual([
      ETranslations.referral_perps_total,
      ETranslations.referral_perps_volume,
      ETranslations.referral_perps_invited_addresses,
    ]);
    expect(summary.rows?.[0].value).toBe('3');
    expect(summary.rows?.[1].hint).toBe(
      `${ETranslations.referral_perps_onekey_fee}: $1.00`,
    );
  });
});
