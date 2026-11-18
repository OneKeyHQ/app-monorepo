/** @jest-environment jsdom */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Primitive = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', null, children);

  return {
    NumberSizeableText: Primitive,
    SizableText: Primitive,
    Skeleton: () => null,
    XStack: Primitive,
    YStack: Primitive,
  };
});

jest.mock('@onekeyhq/kit/src/components/InfoIcon', () => ({
  InfoIcon: () => <div data-testid="reward-schedule-info" />,
}));

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { RewardSummaryCard } from './RewardSummaryCard';

describe('RewardSummaryCard', () => {
  it('shows the unpaid amount without a schedule tooltip', () => {
    render(
      <RewardSummaryCard
        totalBonus="12"
        undistributed="3"
        tokenSymbol="USDC"
      />,
    );

    expect(screen.getByText(ETranslations.referral_undistributed)).toBeTruthy();
    expect(screen.queryByTestId('reward-schedule-info')).toBeNull();
    expect(
      screen.queryByText(ETranslations.earn_reward_distribution_schedule),
    ).toBeNull();
  });
});
