import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
  storeName?: EJotaiContextStoreNames;
  pageType?: EPageType.modal;
  singleSwapBridgeHeader?: boolean;
  embeddedStockTrade?: boolean;
  stockSpeedConfig?: ISwapStockSpeedConfig;
  stockTradeConfig?: ISwapStockTradeConfig;
  stockTradeHeader?: ReactNode;
  stockTradeIdentityLoading?: boolean;
  reviewContextKey?: string;
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

const MemoEmbeddedSwap = memo(LazyEmbeddedSwap);

function MarketEmbeddedSwapLoading() {
  return (
    <YStack
      testID="market-embedded-swap-trade-loading"
      width="100%"
      minHeight={520}
      gap="$4"
    >
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
  inputDraftKey,
  swapToken,
  inputDraft,
  onInputDraftChange,
  isTradeLoading,
  embeddedStockTrade,
  stockTradeConfig,
  stockTradeHeader,
  stockTradeToken,
  stockTradePortfolioData,
  stockTradeResolvedVariantKeys,
}: {
  inputDraftKey: string;
  swapToken: ISwapToken;
  inputDraft?: ISwapInputAmountDraft;
  onInputDraftChange: (draft: ISwapInputAmountDraft) => void;
  isTradeLoading?: boolean;
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
  const [stockTradeTokenSeed, setStockTradeTokenSeed] =
    useState(stockTradeToken);
  const swapTokenIdentity = `${swapToken.networkId}:${swapToken.contractAddress}`;
  const swapTokenSeedIdentity = `${swapTokenSeed.networkId}:${swapTokenSeed.contractAddress}`;
  const swapTokenReadySignature = `${swapTokenIdentity}:${swapToken.decimals}:${swapToken.symbol}`;
  const swapTokenSeedReadySignature = `${swapTokenSeedIdentity}:${swapTokenSeed.decimals}:${swapTokenSeed.symbol}`;
  useEffect(() => {
    if (
      !isTradeLoading &&
      swapTokenReadySignature !== swapTokenSeedReadySignature
    ) {
      setSwapTokenSeed(swapToken);
    }
  }, [
    isTradeLoading,
    swapToken,
    swapTokenReadySignature,
    swapTokenSeedReadySignature,
  ]);
  const stockTradeTokenReadySignature = stockTradeToken
    ? `${stockTradeToken.networkId}:${stockTradeToken.contractAddress}:${stockTradeToken.decimals}:${stockTradeToken.symbol}`
    : '';
  const stockTradeTokenSeedReadySignature = stockTradeTokenSeed
    ? `${stockTradeTokenSeed.networkId}:${stockTradeTokenSeed.contractAddress}:${stockTradeTokenSeed.decimals}:${stockTradeTokenSeed.symbol}`
    : '';
  const stockTradeIdentityLoading = Boolean(
    isTradeLoading ||
    stockTradeTokenReadySignature !== stockTradeTokenSeedReadySignature,
  );
  useEffect(() => {
    if (
      !isTradeLoading &&
      stockTradeTokenReadySignature !== stockTradeTokenSeedReadySignature
    ) {
      setStockTradeTokenSeed(stockTradeToken);
    }
  }, [
    isTradeLoading,
    stockTradeToken,
    stockTradeTokenReadySignature,
    stockTradeTokenSeedReadySignature,
  ]);
  // Consume the restored draft once, and discard it when the route changes.
  // Live input must not reinitialize the retained Swap component.
  const [initialDraft, setInitialDraft] = useState({
    key: inputDraftKey,
    draft: inputDraft,
  });
  const initialInputAmountDraft =
    initialDraft.key === inputDraftKey ? initialDraft.draft : undefined;
  if (initialDraft.key !== inputDraftKey) {
    setInitialDraft({ key: inputDraftKey, draft: undefined });
  }
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
    (stockTradeTokenSeed ? (
      <MarketStockTradeTarget
        token={stockTradeTokenSeed}
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
      <MemoEmbeddedSwap
        storeName={EJotaiContextStoreNames.marketSwap}
        pageType={EPageType.modal}
        singleSwapBridgeHeader
        swapInitParams={effectiveSwapInitParams}
        embeddedStockTrade={embeddedStockTrade}
        stockSpeedConfig={stockSpeedConfig}
        stockTradeConfig={stockTradeConfig}
        stockTradeHeader={resolvedStockTradeHeader}
        stockTradeIdentityLoading={stockTradeIdentityLoading}
        reviewContextKey={`${inputDraftKey}:${swapTokenIdentity}`}
        stockTradeToken={stockTradeTokenSeed}
        stockTradePortfolioData={stockTradePortfolioData}
        stockTradeResolvedVariantKeys={stockTradeResolvedVariantKeys}
        initialInputAmountDraft={initialInputAmountDraft}
        onInputDraftChange={onInputDraftChange}
      />
    </Stack>
  );
}

function MarketEmbeddedSwapDraft({
  inputDraftKey,
  swapToken,
  disabled,
  isTradeLoading,
  embeddedStockTrade,
  stockTradeConfig,
  stockTradeHeader,
  stockTradeToken,
  stockTradePortfolioData,
  stockTradeResolvedVariantKeys,
}: {
  inputDraftKey: string;
  swapToken: ISwapToken;
  disabled?: boolean;
  isTradeLoading?: boolean;
  embeddedStockTrade?: boolean;
  stockTradeConfig?: ISwapStockTradeConfig;
  stockTradeHeader?: ReactNode;
  stockTradeToken?: ISwapToken;
  stockTradePortfolioData?: IMarketAccountPortfolioDisplayItem[];
  stockTradeResolvedVariantKeys?: string[];
}) {
  const inputDraftRef = useRef<ISwapInputAmountDraft | undefined>(undefined);
  const inputDraftKeyRef = useRef(inputDraftKey);
  if (inputDraftKeyRef.current !== inputDraftKey) {
    inputDraftKeyRef.current = inputDraftKey;
    inputDraftRef.current = undefined;
  }
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

  const hasRenderedContentRef = useRef(false);

  // Disabled desktop routes render their own unavailable state (or no trade
  // panel). Transient stock identity loading keeps the panel shell visible;
  // once the shell has mounted, the stock channel owns partial skeletons.
  if (disabled) {
    return null;
  }
  if (isTradeLoading && !hasRenderedContentRef.current) {
    return <MarketEmbeddedSwapLoading />;
  }
  hasRenderedContentRef.current = true;

  return (
    <MarketEmbeddedSwapContent
      inputDraftKey={inputDraftKey}
      swapToken={swapToken}
      inputDraft={inputDraftRef.current}
      onInputDraftChange={onInputDraftChange}
      isTradeLoading={isTradeLoading}
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
  isTradeLoading,
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
  isTradeLoading?: boolean;
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
        inputDraftKey={inputDraftKey}
        swapToken={swapToken}
        disabled={disabled}
        isTradeLoading={isTradeLoading}
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
