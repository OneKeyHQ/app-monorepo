import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import {
  EPageType,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import type { ISwapInputAmountDraft } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IMarketAccountPortfolioDisplayItem } from '@onekeyhq/shared/types/marketV2';
import type {
  ISwapInitParams,
  ISwapStockSpeedConfig,
  ISwapStockTradeConfig,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { useSpeedSwapInit } from '../components/SwapPanel/hooks/useSpeedSwapInit';

import { MarketStockTradeTarget } from './components/MarketStockTradeTarget';
import { buildMarketEmbeddedSwapInitParams } from './marketEmbeddedSwapUtils';

type IEmbeddedSwapProps = {
  pageType?: EPageType.modal;
  singleSwapBridgeHeader?: boolean;
  embeddedStockTrade?: boolean;
  stockSpeedConfig?: ISwapStockSpeedConfig;
  stockTradeConfig?: ISwapStockTradeConfig;
  stockTradeHeader?: ReactNode;
  stockTradeToken?: ISwapToken;
  stockTradePortfolioData?: IMarketAccountPortfolioDisplayItem[];
  stockTradeResolvedVariantKeys?: string[];
  swapInitParams?: ISwapInitParams;
  initialInputAmountDraft?: ISwapInputAmountDraft;
  onInputDraftChange?: (draft: ISwapInputAmountDraft) => void;
};

const LazyEmbeddedSwap = LazyLoad<IEmbeddedSwapProps>(
  () =>
    import(
      /* webpackChunkName: "market-embedded-swap" */ '../../../Swap/pages/components/SwapMainLand'
    ).then((module) => ({ default: module.default })),
  undefined,
  <MarketEmbeddedSwapLoading />,
);

function MarketEmbeddedSwapLoading() {
  return (
    <YStack width="100%" minHeight={520} gap="$4">
      <Skeleton h="$10" w="$44" borderRadius="$full" />
      <XStack h="$13" alignItems="center" justifyContent="space-between">
        <XStack alignItems="center" gap="$2">
          <Skeleton h="$8" w="$8" radius="round" />
          <YStack gap="$1">
            <Skeleton h="$5" w="$24" />
            <Skeleton h="$4" w="$20" />
          </YStack>
        </XStack>
        <Skeleton h="$6" w="$20" />
      </XStack>
      <YStack h={124} bg="$bgSubdued" borderRadius="$4" p="$3.5" gap="$3">
        <Skeleton h="$5" w="$12" />
        <XStack justifyContent="space-between" alignItems="center">
          <Skeleton h="$8" w="$20" />
          <Skeleton h="$8" w="$24" />
        </XStack>
      </YStack>
      <XStack justifyContent="space-between" alignItems="center">
        <Skeleton h="$5" w="$28" />
        <Skeleton h="$5" w="$20" />
      </XStack>
      <XStack justifyContent="space-between" alignItems="center">
        <Skeleton h="$5" w="$20" />
        <Skeleton h="$5" w="$16" />
      </XStack>
      <Skeleton h="$12" w="100%" borderRadius="$full" />
    </YStack>
  );
}

function getDraftToken(token?: ISwapToken): ISwapToken | undefined {
  return token
    ? {
        ...token,
        accountAddress: undefined,
        balanceParsed: undefined,
        fiatValue: undefined,
        price: undefined,
        reservationValue: undefined,
      }
    : undefined;
}

function MarketEmbeddedSwapContent({
  swapToken,
  inputDraft,
  onInputDraftChange,
  embeddedStockTrade,
  stockTradeConfig,
  stockTradeHeader,
  stockTradeToken,
  stockTradePortfolioData,
  stockTradeResolvedVariantKeys,
}: {
  swapToken: ISwapToken;
  inputDraft?: ISwapInputAmountDraft;
  onInputDraftChange: (draft: ISwapInputAmountDraft) => void;
  embeddedStockTrade?: boolean;
  stockTradeConfig?: ISwapStockTradeConfig;
  stockTradeHeader?: ReactNode;
  stockTradeToken?: ISwapToken;
  stockTradePortfolioData?: IMarketAccountPortfolioDisplayItem[];
  stockTradeResolvedVariantKeys?: string[];
}) {
  // Keep the embedded Swap mounted while the selected stock variant changes.
  // A new variant updates Swap's init params in place, allowing its existing
  // quote/input state to enter the normal loading skeleton rather than
  // remounting the whole trade panel.
  const [swapTokenSeed, setSwapTokenSeed] = useState(swapToken);
  const swapTokenIdentity = `${swapToken.networkId}:${swapToken.contractAddress}`;
  const swapTokenSeedIdentity = `${swapTokenSeed.networkId}:${swapTokenSeed.contractAddress}`;
  const swapTokenReadySignature = `${swapTokenIdentity}:${swapToken.decimals}:${swapToken.symbol}`;
  const swapTokenSeedReadySignature = `${swapTokenSeedIdentity}:${swapTokenSeed.decimals}:${swapTokenSeed.symbol}`;
  useEffect(() => {
    if (swapTokenReadySignature !== swapTokenSeedReadySignature) {
      setSwapTokenSeed(swapToken);
    }
  }, [swapToken, swapTokenReadySignature, swapTokenSeedReadySignature]);
  // Consume the route's draft once per mount; live input must not reinitialize Swap.
  const [initialInputAmountDraft] = useState(inputDraft);
  const { defaultTokens, speedConfigReady, speedSwapConfig } = useSpeedSwapInit(
    swapTokenSeed.networkId,
    true,
  );
  const swapInitParams = useMemo<ISwapInitParams | undefined>(
    () =>
      buildMarketEmbeddedSwapInitParams({
        defaultTokens,
        inputDraft: initialInputAmountDraft,
        swapToken: swapTokenSeed,
      }),
    [defaultTokens, initialInputAmountDraft, swapTokenSeed],
  );
  const stockSpeedConfig = useMemo<ISwapStockSpeedConfig | undefined>(
    () =>
      speedConfigReady
        ? { networkId: swapTokenSeed.networkId, config: speedSwapConfig }
        : undefined,
    [speedConfigReady, speedSwapConfig, swapTokenSeed.networkId],
  );

  // Keep the last valid pair mounted while the next chain's defaults/config
  // are loading. Passing an undefined init pair makes SwapMainLand render an
  // empty state; retaining this pair lets the channel show its partial
  // skeleton until the new pair is ready.
  const lastValidSwapInitParamsRef = useRef<ISwapInitParams | undefined>(
    undefined,
  );
  if (swapInitParams) {
    lastValidSwapInitParamsRef.current = swapInitParams;
  }
  const effectiveSwapInitParams =
    swapInitParams ?? lastValidSwapInitParamsRef.current;
  const hasRenderedSwapRef = useRef(false);
  if (
    (!speedConfigReady || !effectiveSwapInitParams) &&
    !hasRenderedSwapRef.current
  ) {
    return <MarketEmbeddedSwapLoading />;
  }
  hasRenderedSwapRef.current = true;

  const resolvedStockTradeHeader =
    stockTradeHeader ??
    (stockTradeToken ? (
      <MarketStockTradeTarget
        token={stockTradeToken}
        portfolioData={stockTradePortfolioData}
        resolvedVariantKeys={stockTradeResolvedVariantKeys}
      />
    ) : undefined);

  return (
    <Stack
      testID="market-embedded-swap-trade-ready"
      width="100%"
      minHeight={520}
      overflow="hidden"
    >
      <LazyEmbeddedSwap
        pageType={EPageType.modal}
        singleSwapBridgeHeader
        swapInitParams={effectiveSwapInitParams}
        embeddedStockTrade={embeddedStockTrade}
        stockSpeedConfig={stockSpeedConfig}
        stockTradeConfig={stockTradeConfig}
        stockTradeHeader={resolvedStockTradeHeader}
        stockTradeToken={stockTradeToken}
        stockTradePortfolioData={stockTradePortfolioData}
        stockTradeResolvedVariantKeys={stockTradeResolvedVariantKeys}
        initialInputAmountDraft={initialInputAmountDraft}
        onInputDraftChange={onInputDraftChange}
      />
    </Stack>
  );
}

function MarketEmbeddedSwapDraft({
  swapToken,
  disabled,
  embeddedStockTrade,
  stockTradeConfig,
  stockTradeHeader,
  stockTradeToken,
  stockTradePortfolioData,
  stockTradeResolvedVariantKeys,
}: {
  swapToken: ISwapToken;
  disabled?: boolean;
  embeddedStockTrade?: boolean;
  stockTradeConfig?: ISwapStockTradeConfig;
  stockTradeHeader?: ReactNode;
  stockTradeToken?: ISwapToken;
  stockTradePortfolioData?: IMarketAccountPortfolioDisplayItem[];
  stockTradeResolvedVariantKeys?: string[];
}) {
  const inputDraftRef = useRef<ISwapInputAmountDraft | undefined>(undefined);
  const onInputDraftChange = useCallback((draft: ISwapInputAmountDraft) => {
    inputDraftRef.current = {
      fromToken: getDraftToken(draft.fromToken),
      toToken: getDraftToken(draft.toToken),
      fromTokenAmount: draft.fromTokenAmount.isInput
        ? draft.fromTokenAmount
        : { value: '', isInput: false },
      toTokenAmount: draft.toTokenAmount.isInput
        ? draft.toTokenAmount
        : { value: '', isInput: false },
    };
  }, []);

  // Disabled desktop routes render their own unavailable state (or no trade
  // panel). Do not present a perpetual loading skeleton for a terminal state.
  return disabled ? null : (
    <MarketEmbeddedSwapContent
      swapToken={swapToken}
      inputDraft={inputDraftRef.current}
      onInputDraftChange={onInputDraftChange}
      embeddedStockTrade={embeddedStockTrade}
      stockTradeConfig={stockTradeConfig}
      stockTradeHeader={stockTradeHeader}
      stockTradeToken={stockTradeToken}
      stockTradePortfolioData={stockTradePortfolioData}
      stockTradeResolvedVariantKeys={stockTradeResolvedVariantKeys}
    />
  );
}

export function MarketEmbeddedSwap({
  swapToken,
  inputDraftKey,
  disabled,
  embeddedStockTrade,
  stockTradeConfig,
  stockTradeHeader,
  stockTradeToken,
  stockTradePortfolioData,
  stockTradeResolvedVariantKeys,
}: {
  swapToken: ISwapToken;
  inputDraftKey: string;
  disabled?: boolean;
  embeddedStockTrade?: boolean;
  stockTradeConfig?: ISwapStockTradeConfig;
  stockTradeHeader?: ReactNode;
  stockTradeToken?: ISwapToken;
  stockTradePortfolioData?: IMarketAccountPortfolioDisplayItem[];
  stockTradeResolvedVariantKeys?: string[];
}) {
  return (
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.swap }}
      enabledNum={[0, 1]}
    >
      <MarketEmbeddedSwapDraft
        key={inputDraftKey}
        swapToken={swapToken}
        disabled={disabled}
        embeddedStockTrade={embeddedStockTrade}
        stockTradeConfig={stockTradeConfig}
        stockTradeHeader={stockTradeHeader}
        stockTradeToken={stockTradeToken}
        stockTradePortfolioData={stockTradePortfolioData}
        stockTradeResolvedVariantKeys={stockTradeResolvedVariantKeys}
      />
    </AccountSelectorProviderMirror>
  );
}
