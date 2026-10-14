/** @jest-environment jsdom */

import { StrictMode, createContext, useContext, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  ISwapReviewClose,
  ISwapReviewConfirm,
  ISwapReviewOpen,
  ISwapReviewReady,
} from '@onekeyhq/shared/types/swap/reviewAnalytics';
import {
  EProtocolOfExchange,
  ESwapNetworkFeeLevel,
  ESwapStepStatus,
  ESwapStepType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import type { ISwapReviewState } from '../../utils/swapReviewState';

const emptyState: ISwapReviewState = { steps: [], preSwapData: {} };
const ReviewStateContext = createContext<
  [ISwapReviewState, Dispatch<SetStateAction<ISwapReviewState>>]
>([emptyState, () => undefined]);
function useTestSwapStepsAtom() {
  return useContext(ReviewStateContext);
}
const mockSetAtom = jest.fn();
const mockAtoms = {
  useSwapStepsAtom: useTestSwapStepsAtom,
  useSwapStepNetFeeLevelAtom: () => [
    { networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM },
    mockSetAtom,
  ],
  useSwapLimitPriceUseRateAtom: () => [undefined],
  useSwapLimitPriceMarketPriceAtom: () => [undefined],
  useSwapTypeSwitchAtom: () => [ESwapTabSwitchType.SWAP, mockSetAtom],
  useSwapSelectFromTokenAtom: () => [undefined, mockSetAtom],
  useSwapSelectToTokenAtom: () => [undefined, mockSetAtom],
  useSwapFromTokenAmountAtom: () => [undefined, mockSetAtom],
  useSwapToTokenAmountAtom: () => [undefined, mockSetAtom],
  useSwapQuoteListAtom: () => [[], mockSetAtom],
  useSwapManualSelectQuoteProvidersAtom: () => [undefined, mockSetAtom],
  useSwapBuildTxFetchingAtom: () => [false, mockSetAtom],
};
let mockSetReviewState: Dispatch<SetStateAction<ISwapReviewState>>;

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap', () => mockAtoms);
jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/swap/atoms',
  () => mockAtoms,
);
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: { wallet: { id: 'hd-1', type: 'hd' } },
  }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsAtom: () => [{}, mockSetAtom],
  useSettingsPersistAtom: () => [{ currencyInfo: { id: 'usd', symbol: '$' } }],
  useCurrencyPersistAtom: () => [{ currencyMap: {} }],
  useInAppNotificationAtom: () => [
    { swapHistoryPendingList: [], swapLimitOrders: [] },
    mockSetAtom,
  ],
  filterSwapHistoryPendingList: (items: unknown[]) => items,
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/shared/src/locale', () => ({ ETranslations: {} }));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: { isHwWallet: () => false, isExternalWallet: () => false },
}));
jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: { toastIfError: jest.fn(), showToastOfError: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/utils/tokenUtils', () => ({
  equalTokenNoCaseSensitive: () => false,
}));
jest.mock('@onekeyhq/shared/src/utils/miscUtils', () => ({
  generateUUID: () => 'review-1',
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { swap: { swapReview: {} } },
}));
jest.mock(
  '@onekeyhq/shared/src/logger/scopes/swap/scenes/swapEstimateFee',
  () => ({ ESwapEventAPIStatus: { SUCCESS: 'success', FAIL: 'fail' } }),
);
jest.mock('../../utils/swapTypeUtils', () => ({
  getSwapExecutionTypeFromQuoteResult: () => 'swap',
  getVisibleSwapTabSwitchType: (value: string) => value,
}));
jest.mock('../../utils/swapStockAnalytics', () => ({
  getSwapAnalyticsCategoryFromSwapType: () => 'Swap',
}));
jest.mock('../../utils/swapStockReviewUtils', () => ({
  buildSwapStockReviewDisplay: () => undefined,
}));
jest.mock('../../utils/quoteShowTipUtils', () => ({
  resolveQuoteShowTip: ({ quoteShowTip }: { quoteShowTip?: unknown }) =>
    quoteShowTip,
}));
jest.mock('../../utils/swapStepHistory', () => ({
  reconcileSwapStepWithHistory: jest.fn(),
}));
jest.mock('../../utils/swapReviewState', () => ({
  NATIVE_BTC_MIN_SLIPPAGE_PERCENTAGE: 1,
  invalidateSwapReviewForSlippageChange: jest.fn(),
  shouldShowSwapReviewToAmountSkeleton: () => false,
}));
jest.mock('../../components/PreSwapConfirmResult', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../components/PreSwapInfoGroup', () => ({
  __esModule: true,
  default: () => null,
  SWAP_REVIEW_CUSTOM_NETWORK_FEE_VALUE: 'custom',
}));
jest.mock('../../components/PreSwapStep', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../components/PreSwapTokenItem', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../components/SwapReviewSlippageEditor', () => ({
  SwapReviewSlippageEditor: () => null,
}));
jest.mock('../../components/PreSwapTipInfo', () => ({
  PreSwapTipInfo: ({
    onConfirm,
    onCancel,
  }: {
    onConfirm: () => void;
    onCancel: () => void;
  }) => (
    <>
      <button type="button" onClick={onConfirm}>
        risk-continue
      </button>
      <button type="button" onClick={onCancel}>
        risk-cancel
      </button>
    </>
  ),
}));
jest.mock('@onekeyhq/components', () => {
  const Container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Alert: () => null,
    Button: ({
      children,
      onPress,
      disabled,
      testID,
    }: {
      children?: ReactNode;
      onPress: () => void;
      disabled?: boolean;
      testID?: string;
    }) => (
      <button
        type="button"
        data-testid={testID}
        onClick={onPress}
        disabled={disabled}
      >
        {children}
      </button>
    ),
    Dialog: { Header: () => null, Title: Container },
    Divider: () => null,
    HeightTransition: Container,
    Icon: () => null,
    NumberSizeableText: Container,
    Popover: () => null,
    SizableText: Container,
    Stack: Container,
    XStack: Container,
    YStack: Container,
  };
});

const { createSwapReviewAnalytics } =
  require('../../utils/swapReviewAnalytics') as typeof import('../../utils/swapReviewAnalytics');
const PreSwapDialogContent = (
  require('./PreSwapDialogContent') as typeof import('./PreSwapDialogContent')
).default;
const { SwapReviewInitializer } =
  require('./SwapReviewInitializer') as typeof import('./SwapReviewInitializer');

function makeState(): ISwapReviewState {
  const fromToken = {
    networkId: 'evm--1',
    contractAddress: '',
    symbol: 'ETH',
    decimals: 18,
  };
  const toToken = { ...fromToken, symbol: 'USDC', decimals: 6 };
  return {
    steps: [{ type: ESwapStepType.SEND_TX, status: ESwapStepStatus.READY }],
    preSwapData: {
      fromToken,
      toToken,
      supportPreBuild: true,
      supportNetworkFeeLevel: true,
      swapType: ESwapTabSwitchType.SWAP,
    },
    quoteResult: {
      quoteId: 'quote-1',
      protocol: EProtocolOfExchange.SWAP,
      info: {
        provider: 'provider',
        providerName: 'Provider',
        providerLogo: '',
      },
      fromTokenInfo: fromToken,
      toTokenInfo: toToken,
      fromAmount: '1',
      toAmount: '2',
      allowanceResult: { allowanceTarget: 'target', amount: '1' },
    },
  };
}

function StateProvider({
  initialState,
  children,
}: {
  initialState: ISwapReviewState;
  children: ReactNode;
}) {
  const state = useState(initialState);
  mockSetReviewState = state[1];
  return (
    <ReviewStateContext.Provider value={state}>
      {children}
    </ReviewStateContext.Provider>
  );
}

function createSession() {
  const logger = {
    swapReviewOpen: jest.fn<void, [ISwapReviewOpen]>(),
    swapReviewReady: jest.fn<void, [ISwapReviewReady]>(),
    swapReviewConfirm: jest.fn<void, [ISwapReviewConfirm]>(),
    swapReviewClose: jest.fn<void, [ISwapReviewClose]>(),
  };
  return {
    logger,
    session: createSwapReviewAnalytics({ logger, clock: () => 0 }),
  };
}

describe('PreSwapDialogContent analytics integration', () => {
  it('continues the primary confirmation when lifecycle logging throws', () => {
    const { session, logger } = createSession();
    Object.values(logger).forEach((log) => {
      log.mockImplementation(() => {
        throw new OneKeyLocalError('Telemetry unavailable');
      });
    });
    const initial = makeState();
    initial.preSwapData.supportPreBuild = false;
    const onConfirm = jest.fn();
    render(
      <StateProvider initialState={initial}>
        <PreSwapDialogContent
          reviewAnalytics={session}
          onConfirm={onConfirm}
          onDone={jest.fn()}
          preSwapBeforeStepActions={jest.fn()}
          preSwapStepsStart={jest.fn()}
        />
      </StateProvider>,
    );

    fireEvent.click(screen.getByTestId('swap-btn'));

    expect(logger.swapReviewOpen).toHaveBeenCalledTimes(1);
    expect(logger.swapReviewReady).toHaveBeenCalledTimes(1);
    expect(logger.swapReviewConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(session.isConfirmed()).toBe(true);
    session.close();
    expect(logger.swapReviewClose).not.toHaveBeenCalled();
  });

  it('waits for layout-triggered preparation even before atom loading reaches render', async () => {
    const { session, logger } = createSession();
    let finish: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const prepare = jest.fn(() => pending);
    const onConfirm = jest.fn();
    render(
      <StateProvider initialState={makeState()}>
        <PreSwapDialogContent
          reviewAnalytics={session}
          onConfirm={onConfirm}
          onDone={() => session.close()}
          preSwapBeforeStepActions={prepare}
          preSwapStepsStart={jest.fn()}
        />
      </StateProvider>,
    );
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(logger.swapReviewOpen).toHaveBeenCalledWith(
      expect.objectContaining({ needApprove: true, quoteId: 'quote-1' }),
    );
    expect(logger.swapReviewReady).not.toHaveBeenCalled();
    await act(async () => {
      finish();
      await pending;
    });
    expect(logger.swapReviewReady).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('swap-btn'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(logger.swapReviewConfirm).toHaveBeenCalledTimes(1);
    session.close();
    expect(logger.swapReviewClose).not.toHaveBeenCalled();
  });

  it('uses the supplied Market identity before passive hydration and reports Ready afterwards', () => {
    const { session, logger } = createSession();
    const initial = makeState();
    const prepare = jest.fn();
    render(
      <StrictMode>
        <StateProvider initialState={emptyState}>
          <SwapReviewInitializer reviewState={initial}>
            <PreSwapDialogContent
              reviewAnalytics={session}
              analyticsInitialState={initial}
              analyticsCreateFrom="marketDex"
              onConfirm={jest.fn()}
              onDone={jest.fn()}
              preSwapBeforeStepActions={prepare}
              preSwapStepsStart={jest.fn()}
            />
          </SwapReviewInitializer>
        </StateProvider>
      </StrictMode>,
    );
    expect(logger.swapReviewOpen).toHaveBeenCalledTimes(1);
    expect(logger.swapReviewOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        createFrom: 'marketDex',
        sourceChain: 'evm--1',
        quoteId: 'quote-1',
      }),
    );
    expect(logger.swapReviewReady).toHaveBeenCalledTimes(1);
    expect(logger.swapReviewReady).toHaveBeenCalledWith(
      expect.objectContaining({ quoteId: 'quote-1', status: 'ready' }),
    );
    expect(logger.swapReviewClose).not.toHaveBeenCalled();
  });

  it('counts the main Confirm once across risk-tip cancel and continue', () => {
    const { session, logger } = createSession();
    const initial = makeState();
    initial.preSwapData.supportPreBuild = false;
    if (initial.quoteResult)
      initial.quoteResult.quoteShowTip = {
        title: 'Risk',
        detail: 'Risk details',
      };
    const onConfirm = jest.fn();
    render(
      <StateProvider initialState={initial}>
        <PreSwapDialogContent
          reviewAnalytics={session}
          onConfirm={onConfirm}
          onDone={jest.fn()}
          preSwapBeforeStepActions={jest.fn()}
          preSwapStepsStart={jest.fn()}
        />
      </StateProvider>,
    );
    fireEvent.click(screen.getByTestId('swap-btn'));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('risk-cancel'));
    fireEvent.click(screen.getByTestId('swap-btn'));
    fireEvent.click(screen.getByText('risk-continue'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(logger.swapReviewConfirm).toHaveBeenCalledTimes(1);
  });

  it('reports the initial preparation failure and closes as error', async () => {
    const { session, logger } = createSession();
    const prepare = jest.fn(async () => {
      mockSetReviewState((previous) => ({
        ...previous,
        preSwapData: { ...previous.preSwapData, stepBeforeActionsError: true },
      }));
    });
    render(
      <StateProvider initialState={makeState()}>
        <PreSwapDialogContent
          reviewAnalytics={session}
          onConfirm={jest.fn()}
          onDone={jest.fn()}
          preSwapBeforeStepActions={prepare}
          preSwapStepsStart={jest.fn()}
        />
      </StateProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(logger.swapReviewReady).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error' }),
    );
    expect(screen.getByTestId('swap-btn').hasAttribute('disabled')).toBe(true);
    session.close('user');
    expect(logger.swapReviewClose).toHaveBeenCalledWith(
      expect.objectContaining({ closeStage: 'error', closeReason: 'user' }),
    );
  });
});
