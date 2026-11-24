/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';

import type { IInviteLevelDetail } from '@onekeyhq/shared/src/referralCode/type';

import { useInviteValueSummary } from './InviteValueLine';

import type { ICurrentLevelCardProps } from './CurrentLevelCard/types';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

const STANDARD_RATE = {
  rebate: 10,
  discount: 0,
  enabled: true,
  hasThreshold: false,
};

const BASE: ICurrentLevelCardProps = {
  rebateConfig: {
    level: 0,
    emoji: '',
    icon: '',
    label: 'Bronze',
    labelKey: '',
    rebate: 10,
    discount: 0,
    threshold: 0,
    thresholdFiatValue: '0',
    configs: { HardwareSales: STANDARD_RATE },
  },
  rebateLevels: [],
};

const DETAIL: IInviteLevelDetail = {
  currentLevel: 0,
  levelProgress: {},
  levels: [
    {
      level: 0,
      icon: '',
      emoji: '',
      label: 'Bronze',
      labelKey: '',
      isCurrent: true,
      upgradeConditions: [],
      commissionRates: { HardwareSales: STANDARD_RATE },
    },
  ],
};

describe('personal referral rate display', () => {
  it.each([undefined, null])(
    'removes partner benefits with the refreshed summary even if level detail still has a plan (%s)',
    (removedPlan) => {
      const personalConfig = {
        HardwareSales: { status: 'ok', rebate: 50, discount: 8 },
      };
      const staleDetail: IInviteLevelDetail = {
        ...DETAIL,
        configs: personalConfig,
        partnerPlan: { planId: 'test-plan' },
      };
      const withPlan: ICurrentLevelCardProps = {
        ...BASE,
        configs: personalConfig,
        partnerPlan: { planId: 'test-plan' },
      };
      const { result, rerender } = renderHook(
        (props: ICurrentLevelCardProps) =>
          useInviteValueSummary({ ...props, levelDetail: staleDetail }),
        { initialProps: withPlan },
      );
      expect(result.current).toMatchObject({
        levelLabel: 'Bronze',
        hasPartnerPlan: true,
        summary: { rate: '50%', friendRate: '8%' },
      });

      rerender({
        ...BASE,
        partnerPlan: removedPlan,
        configs: { HardwareSales: { status: 'ok', rebate: 10, discount: 0 } },
      });
      expect(result.current).toMatchObject({
        levelLabel: 'Bronze',
        hasPartnerPlan: false,
        summary: { rate: '10%', friendRate: null },
      });
      expect(staleDetail.levels[0].commissionRates).toEqual({
        HardwareSales: STANDARD_RATE,
      });
    },
  );

  it('supports an older response without personal fields', () => {
    const { result } = renderHook(() =>
      useInviteValueSummary({ ...BASE, levelDetail: DETAIL }),
    );
    expect(result.current).toMatchObject({
      levelLabel: 'Bronze',
      hasPartnerPlan: false,
      summary: { rate: '10%' },
    });
  });
});
