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
const mockMedia = { lg: false, md: false };

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Stack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
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
  ResponsiveFourColumnLayout: ({
    firstColumn,
    secondColumn,
    thirdColumn,
    fourthColumn,
  }: {
    firstColumn: ReactNode;
    secondColumn: ReactNode;
    thirdColumn: ReactNode;
    fourthColumn: ReactNode;
  }) => (
    <>
      {firstColumn}
      {secondColumn}
      {thirdColumn}
      {fourthColumn}
    </>
  ),
  StatCard: (props: IStatCardProps) => {
    mockCards.push(props);
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
    mockMedia.lg = false;
    mockMedia.md = false;
  });

  it('associates the next distribution date with undistributed rewards', () => {
    render(<SwapRewardHeader data={data} />);

    const undistributedCard = mockCards.find(
      (card) => card.title === ETranslations.referral_undistributed,
    );
    const pendingCard = mockCards.find(
      (card) => card.title === ETranslations.referral_pending,
    );

    expect(undistributedCard?.subtitle).toContain(
      `${ETranslations.referral_next_distribution}: Aug 1`,
    );
    expect(pendingCard?.subtitle).toBeUndefined();
  });

  it('uses the Perps-style primary and two-card layout on mobile', () => {
    mockMedia.lg = true;
    mockMedia.md = true;

    render(<SwapRewardHeader data={data} />);

    expect(mockCards.map((card) => card.title)).toEqual([
      ETranslations.referral_undistributed,
      ETranslations.referral_perps_volume,
      ETranslations.referral_perps_invited_addresses,
    ]);
    expect(mockCards[0].subtitle).toContain(
      `${ETranslations.referral_pending}: $1.00`,
    );
    expect(mockCards[0].fullWidth).toBe(true);
  });
});
