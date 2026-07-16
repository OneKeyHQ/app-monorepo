/** @jest-environment jsdom */

import type { MouseEvent, ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';

import { SwapTestIDs } from '../../testIDs';

import SwapQuoteResult from './SwapQuoteResult';

let mockProviderSelectionReady = false;
let mockSwapQuoteLoading = true;
let mockQuoteProgressState: {
  displayQuote?: IFetchQuoteResult;
  isWaitingActionableQuote: boolean;
  phase: string;
} = {
  displayQuote: undefined,
  isWaitingActionableQuote: true,
  phase: 'waiting',
};
const mockSwapQuoteResultRate = jest.fn((_props: unknown) => null);

type IPrimitiveProps = {
  children?: ReactNode | ((state: { open: boolean }) => ReactNode);
  onPress?: (event: MouseEvent<HTMLDivElement>) => void;
  testID?: string;
};

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Primitive = ({ children, onPress, testID }: IPrimitiveProps) =>
    React.createElement(
      'div',
      {
        'data-testid': testID,
        onClick: onPress,
      },
      typeof children === 'function' ? children({ open: false }) : children,
    );
  const Accordion = Object.assign(Primitive, {
    Content: Primitive,
    HeightAnimator: Primitive,
    Item: Primitive,
    Trigger: Primitive,
  });

  return {
    Accordion,
    ANIMATE_ONLY_OPACITY: [],
    Divider: Primitive,
    Icon: Primitive,
    Keyboard: { dismiss: jest.fn() },
    LottieView: Primitive,
    NumberSizeableText: Primitive,
    SizableText: Primitive,
    XStack: Primitive,
    YStack: Primitive,
  };
});

jest.mock('@onekeyhq/kit/src/hooks/useDebounce', () => ({
  useDebounce: <T,>(value: T) => value,
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap', () => ({
  useSwapFromTokenAmountAtom: () => [{ isInput: true, value: '1' }],
  useSwapLimitExpirationTimeAtom: () => [undefined, jest.fn()],
  useSwapLimitPartiallyFillAtom: () => [undefined, jest.fn()],
  useSwapQuoteListAtom: () => [[]],
  useSwapQuoteProviderSelectionReadyAtom: () => [mockProviderSelectionReady],
  useSwapSelectFromTokenAtom: () => [
    {
      contractAddress: '',
      decimals: 18,
      networkId: 'evm--1',
      symbol: 'ETH',
    },
  ],
  useSwapSelectToTokenAtom: () => [
    {
      contractAddress: '0xusdc',
      decimals: 6,
      networkId: 'evm--1',
      symbol: 'USDC',
    },
  ],
  useSwapTokenMetadataAtom: () => [undefined],
  useSwapTypeSwitchAtom: () => ['swap'],
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap/quoteProgress', () => ({
  ESwapQuoteUiPhase: {
    Error: 'error',
    StaleRefreshing: 'staleRefreshing',
    Waiting: 'waiting',
    ZeroProvider: 'zeroProvider',
  },
  isSwapQuoteActionable: (quote?: IFetchQuoteResult) =>
    Boolean(quote?.info?.provider),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useInAppNotificationAtom: () => [
    {
      swapApprovingLoading: false,
      swapApprovingTransaction: undefined,
    },
    jest.fn(),
  ],
  useSettingsPersistAtom: () => [{ currencyInfo: { symbol: '$' } }],
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('../../components/LimitExpirySelect', () => () => null);
jest.mock('../../components/LimitPartialFillSelect', () => () => null);
jest.mock('../../components/SwapApprovingItem', () => () => null);
jest.mock('../../components/SwapCommonInfoItem', () => () => null);
jest.mock('../../components/SwapProviderInfoItem', () => () => null);
jest.mock('../../components/SwapQuoteResultRate', () => ({
  __esModule: true,
  default: (props: unknown) => mockSwapQuoteResultRate(props),
}));
jest.mock('../../hooks/useSwapGlobal', () => ({
  useSwapLimitConfigMaps: () => ({
    limitOrderExpiryStepMap: {},
    limitOrderPartiallyFillStepMap: {},
  }),
}));
jest.mock('../../hooks/useSwapSlippageActions', () => ({
  useSwapSlippageActions: () => ({
    onSlippageHandleClick: jest.fn(),
    slippageItem: { key: 'auto', value: 0.5 },
  }),
}));
jest.mock('../../hooks/useSwapState', () => ({
  useSwapQuoteLoading: () => mockSwapQuoteLoading,
  useSwapQuoteProgressState: () => mockQuoteProgressState,
}));
jest.mock('./SwapApproveAllowanceSelectContainer', () => () => null);
jest.mock('./SwapSlippageTriggerContainer', () => () => null);

function renderSubject(providerSelectionReady: boolean) {
  mockProviderSelectionReady = providerSelectionReady;
  const onOpenProviderList = jest.fn();
  const refreshAction = jest.fn();

  render(
    <SwapQuoteResult
      onOpenProviderList={onOpenProviderList}
      refreshAction={refreshAction}
    />,
  );

  return { onOpenProviderList, refreshAction };
}

describe('SwapQuoteResult requesting provider selection', () => {
  beforeEach(() => {
    mockSwapQuoteResultRate.mockClear();
    mockSwapQuoteLoading = true;
    mockQuoteProgressState = {
      displayQuote: undefined,
      isWaitingActionableQuote: true,
      phase: 'waiting',
    };
  });

  it('keeps the waiting row non-interactive before an actionable candidate', () => {
    const { onOpenProviderList } = renderSubject(false);

    expect(screen.queryByTestId(SwapTestIDs.providerSelector)).toBeNull();
    fireEvent.click(screen.getByText(ETranslations.swap_loading_content));

    expect(onOpenProviderList).not.toHaveBeenCalled();
    expect(mockSwapQuoteResultRate).not.toHaveBeenCalled();
  });

  it('opens the provider picker from the waiting row before settlement', () => {
    const { onOpenProviderList, refreshAction } = renderSubject(true);

    fireEvent.click(screen.getByTestId(SwapTestIDs.providerSelector));

    expect(onOpenProviderList).toHaveBeenCalledTimes(1);
    expect(refreshAction).not.toHaveBeenCalled();
    expect(mockSwapQuoteResultRate).not.toHaveBeenCalled();
  });

  it('keeps the committed rate visible while a refresh is loading', () => {
    const displayQuote = {
      fromAmount: '1',
      fromTokenInfo: {
        contractAddress: '',
        decimals: 18,
        networkId: 'evm--1',
        symbol: 'ETH',
      },
      info: {
        provider: 'provider-a',
        providerName: 'Provider A',
      },
      instantRate: '2000',
      toAmount: '2000',
      toTokenInfo: {
        contractAddress: '0xusdc',
        decimals: 6,
        networkId: 'evm--1',
        symbol: 'USDC',
      },
    } as IFetchQuoteResult;
    mockProviderSelectionReady = true;
    mockQuoteProgressState = {
      displayQuote,
      isWaitingActionableQuote: false,
      phase: 'staleRefreshing',
    };

    renderSubject(true);

    expect(mockSwapQuoteResultRate).toHaveBeenCalledTimes(1);
    expect(mockSwapQuoteResultRate).toHaveBeenCalledWith(
      expect.objectContaining({
        isLoading: false,
        rate: '2000',
      }),
    );
  });
});
