import { Children } from 'react';

import type { ReactElement, ReactNode } from 'react';
import { renderHook } from '@testing-library/react-native';

import type {
  IEarnTooltip,
  IStakeTransactionConfirmation,
} from '@onekeyhq/shared/types/staking';

import { EarnTooltip } from './EarnTooltip';
import { usePendleTransactionDetails } from './PendleSharedComponents';


jest.mock('@onekeyhq/components', () => ({
  Divider: 'Divider',
  Icon: 'Icon',
  Popover: 'Popover',
  SizableText: 'SizableText',
  Skeleton: 'Skeleton',
  Stack: 'Stack',
  XStack: 'XStack',
  YStack: 'YStack',
}));
jest.mock('@onekeyhq/components/src/utils/animationConstants', () => ({
  ANIMATE_ONLY_TRANSFORM: [],
}));
jest.mock('../CalculationList', () => {
  const CalculationListItem = Object.assign(() => null, {
    Label: () => null,
  });
  return { CalculationListItem };
});
jest.mock('./EarnActionIcon', () => ({ ActionPopupContent: () => null }));
jest.mock('./EarnAmountText', () => ({ EarnAmountText: () => null }));
jest.mock('./EarnSwapRoute', () => ({ EarnSwapRoute: () => null }));
jest.mock('./EarnText', () => ({ EarnText: () => null }));
jest.mock('./EarnTooltip', () => ({ EarnTooltip: () => null }));

function getElementChildren(element: ReactElement): ReactNode[] {
  return Children.toArray((element.props as { children?: ReactNode }).children);
}

describe('usePendleTransactionDetails', () => {
  it('preserves structured text tooltip data for remote typography', () => {
    const tooltip = {
      type: 'text',
      data: {
        title: { text: 'About fees' },
        description: {
          text: 'Fee details',
          size: '$bodyXs',
        },
      },
    } satisfies IEarnTooltip;
    const transactionConfirmation: IStakeTransactionConfirmation = {
      transactionDetails: {
        type: 'view',
        data: {
          transactionDetails: [
            {
              title: { text: 'Fee' },
              description: { text: '0.12%' },
              tooltip,
            },
          ],
        },
      },
    };

    const { result } = renderHook(() =>
      usePendleTransactionDetails({
        transactionConfirmation,
        amountValue: '1',
        isPendleLikeLayout: true,
      }),
    );

    const labelContainer = getElementChildren(
      result.current[0],
    )[0] as ReactElement;
    const tooltipElement = getElementChildren(
      labelContainer,
    )[1] as ReactElement<{
      tooltip?: IEarnTooltip;
    }>;

    expect(tooltipElement.type).toBe(EarnTooltip);
    expect(tooltipElement.props.tooltip).toBe(tooltip);
  });
});
