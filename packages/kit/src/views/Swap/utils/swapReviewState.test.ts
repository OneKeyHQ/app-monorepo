import { ESwapStepStatus } from '@onekeyhq/shared/types/swap/types';
import type { ISwapStep } from '@onekeyhq/shared/types/swap/types';

import {
  hasInFlightSwapReviewSteps,
  shouldCloseSwapReviewOnFocusLoss,
  shouldShowSwapReviewToAmountSkeleton,
} from './swapReviewState';

describe('shouldCloseSwapReviewOnFocusLoss', () => {
  const baseParams = {
    isFocused: false,
    isAppLocked: false,
    hasInFlightSteps: false,
    initialRootRouterCount: 1,
    currentRootRouterCount: 1,
  };

  it('closes an open or pending review after the route actually loses focus', () => {
    expect(shouldCloseSwapReviewOnFocusLoss(baseParams)).toBe(true);
  });

  it('keeps an open or pending review while app lock covers the route', () => {
    expect(
      shouldCloseSwapReviewOnFocusLoss({
        ...baseParams,
        isAppLocked: true,
      }),
    ).toBe(false);
  });

  it('keeps an open or pending review while a root modal covers the route', () => {
    expect(
      shouldCloseSwapReviewOnFocusLoss({
        ...baseParams,
        currentRootRouterCount: 2,
      }),
    ).toBe(false);
  });

  it('keeps the review after a tab switch while a swap step is in flight', () => {
    expect(
      shouldCloseSwapReviewOnFocusLoss({
        ...baseParams,
        hasInFlightSteps: true,
      }),
    ).toBe(false);
  });
});

describe('hasInFlightSwapReviewSteps', () => {
  const step = (status: ESwapStepStatus) => ({ status }) as ISwapStep;

  it('does not treat prepared steps as in flight', () => {
    expect(
      hasInFlightSwapReviewSteps({
        steps: [step(ESwapStepStatus.READY)],
      }),
    ).toBe(false);
  });

  it.each([ESwapStepStatus.LOADING, ESwapStepStatus.PENDING])(
    'treats a %s step as in flight',
    (status) => {
      expect(
        hasInFlightSwapReviewSteps({
          steps: [step(status)],
        }),
      ).toBe(true);
    },
  );
});

describe('shouldShowSwapReviewToAmountSkeleton', () => {
  it('keeps the frozen quote amount visible while the build is loading', () => {
    expect(
      shouldShowSwapReviewToAmountSkeleton({
        swapBuildLoading: true,
        toTokenAmount: '21.4568',
      }),
    ).toBe(false);
  });

  it('shows a skeleton when the build is loading without an amount', () => {
    expect(
      shouldShowSwapReviewToAmountSkeleton({
        swapBuildLoading: true,
        toTokenAmount: '',
      }),
    ).toBe(true);
  });

  it('does not show a skeleton after the build settles', () => {
    expect(
      shouldShowSwapReviewToAmountSkeleton({
        swapBuildLoading: false,
        toTokenAmount: '',
      }),
    ).toBe(false);
  });
});
