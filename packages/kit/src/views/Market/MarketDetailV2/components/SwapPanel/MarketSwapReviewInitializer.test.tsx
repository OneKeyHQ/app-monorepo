/** @jest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import { createStore } from 'jotai';

import {
  ProviderJotaiContextSwap,
  useSwapBuildTxFetchingAtom,
  useSwapFromTokenAmountAtom,
  useSwapQuoteListAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapStepsAtom,
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap/atoms';
import { buildSwapReviewState } from '@onekeyhq/kit/src/views/Swap/utils/buildSwapReviewState';
import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { MarketSwapReviewInitializer } from './MarketSwapReviewInitializer';

const fromToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xfrom',
  symbol: 'ETH',
  decimals: 18,
  isNative: true,
};

const toToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xto',
  symbol: 'USDC',
  decimals: 6,
  isNative: false,
};

const texts = {
  wrap: 'Wrap',
  approveAndSwap: 'Approve and Swap',
  approveAndSign: 'Approve and Sign',
  revokeApprove: 'Revoke Approve',
  approveToken: 'Approve ETH',
  approveTokenWithTarget: 'Approve ETH for OneKey',
  signAndSubmit: 'Sign and Submit',
  sign: 'Sign',
  confirmSwap: 'Confirm Swap',
  swap: 'Swap',
};

function createQuoteResult(
  overrides: Partial<IFetchQuoteResult> = {},
): IFetchQuoteResult {
  return {
    protocol: EProtocolOfExchange.SWAP,
    info: {
      provider: 'onekey',
      providerName: 'OneKey',
    },
    fromTokenInfo: fromToken,
    toTokenInfo: toToken,
    ...overrides,
  };
}

function StateProbe({ testId }: { testId: string }) {
  const [swapType] = useSwapTypeSwitchAtom();
  const [selectedFromToken] = useSwapSelectFromTokenAtom();
  const [selectedToToken] = useSwapSelectToTokenAtom();
  const [fromAmount] = useSwapFromTokenAmountAtom();
  const [toAmount] = useSwapToTokenAmountAtom();
  const [quoteList] = useSwapQuoteListAtom();
  const [swapSteps] = useSwapStepsAtom();
  const [buildTxFetching] = useSwapBuildTxFetchingAtom();

  return (
    <pre data-testid={testId}>
      {JSON.stringify({
        swapType,
        fromToken: selectedFromToken?.symbol,
        toToken: selectedToToken?.symbol,
        fromAmount: fromAmount.value,
        toAmount: toAmount.value,
        quoteCount: quoteList.length,
        steps: swapSteps.steps.map((step) => step.type),
        buildTxFetching,
      })}
    </pre>
  );
}

function getProbeState(testId: string) {
  return JSON.parse(screen.getByTestId(testId).textContent ?? '{}') as {
    swapType?: string;
    fromToken?: string;
    toToken?: string;
    fromAmount?: string;
    toAmount?: string;
    quoteCount?: number;
    steps?: string[];
    buildTxFetching?: boolean;
  };
}

describe('MarketSwapReviewInitializer', () => {
  it('writes review state into the market review store without polluting another swap store', async () => {
    const reviewState = buildSwapReviewState({
      accountId: 'hd-1--m/44/60/0/0/0',
      networkId: fromToken.networkId,
      batchApproveAndSwapEnabled: true,
      fromToken,
      toToken,
      fromTokenAmount: '1',
      toTokenAmount: '2500',
      quoteResult: createQuoteResult(),
      swapType: ESwapTabSwitchType.SWAP,
      shouldFallback: false,
      supportPreBuild: true,
      slippage: 1,
      texts,
    });
    const marketStore = createStore();
    const swapStore = createStore();

    render(
      <>
        <ProviderJotaiContextSwap store={marketStore}>
          <MarketSwapReviewInitializer reviewState={reviewState}>
            <StateProbe testId="market-store" />
          </MarketSwapReviewInitializer>
        </ProviderJotaiContextSwap>
        <ProviderJotaiContextSwap store={swapStore}>
          <StateProbe testId="swap-store" />
        </ProviderJotaiContextSwap>
      </>,
    );

    await waitFor(() => {
      expect(getProbeState('market-store')).toMatchObject({
        swapType: ESwapTabSwitchType.SWAP,
        fromToken: 'ETH',
        toToken: 'USDC',
        fromAmount: '1',
        toAmount: '2500',
        quoteCount: 1,
        steps: ['send_tx'],
        buildTxFetching: false,
      });
    });

    const swapStoreState = getProbeState('swap-store');

    expect(swapStoreState).toMatchObject({
      swapType: ESwapTabSwitchType.SWAP,
      fromAmount: '',
      toAmount: '',
      quoteCount: 0,
      steps: [],
      buildTxFetching: false,
    });
    expect(swapStoreState.fromToken).toBeUndefined();
    expect(swapStoreState.toToken).toBeUndefined();
  });

  it('cleans review state on unmount', async () => {
    const reviewState = buildSwapReviewState({
      accountId: 'hd-1--m/44/60/0/0/0',
      networkId: fromToken.networkId,
      batchApproveAndSwapEnabled: true,
      fromToken,
      toToken,
      fromTokenAmount: '1',
      toTokenAmount: '2500',
      quoteResult: createQuoteResult(),
      swapType: ESwapTabSwitchType.SWAP,
      shouldFallback: false,
      supportPreBuild: true,
      slippage: 1,
      texts,
    });
    const marketStore = createStore();
    const view = render(
      <ProviderJotaiContextSwap store={marketStore}>
        <MarketSwapReviewInitializer reviewState={reviewState}>
          <StateProbe testId="market-store" />
        </MarketSwapReviewInitializer>
      </ProviderJotaiContextSwap>,
    );

    await waitFor(() => {
      expect(getProbeState('market-store')).toMatchObject({
        fromToken: 'ETH',
        quoteCount: 1,
      });
    });

    view.unmount();

    render(
      <ProviderJotaiContextSwap store={marketStore}>
        <StateProbe testId="market-store-reset" />
      </ProviderJotaiContextSwap>,
    );

    const resetState = getProbeState('market-store-reset');

    expect(resetState).toMatchObject({
      fromAmount: '',
      toAmount: '',
      quoteCount: 0,
      steps: [],
      buildTxFetching: false,
    });
    expect(resetState.fromToken).toBeUndefined();
    expect(resetState.toToken).toBeUndefined();
  });
});
