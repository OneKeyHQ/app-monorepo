import { useCallback, useMemo, useRef, useState } from 'react';

import { EPageType, Spinner, Stack } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import type { ISwapInputAmountDraft } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type {
  ISwapInitParams,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { useSpeedSwapInit } from '../components/SwapPanel/hooks/useSpeedSwapInit';

import { buildMarketEmbeddedSwapInitParams } from './marketEmbeddedSwapUtils';

type IEmbeddedSwapProps = {
  pageType?: EPageType.modal;
  singleSwapBridgeHeader?: boolean;
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
  <Stack height={520} alignItems="center" justifyContent="center">
    <Spinner size="large" />
  </Stack>,
);

function MarketEmbeddedSwapLoading() {
  return (
    <Stack height={520} alignItems="center" justifyContent="center">
      <Spinner size="large" />
    </Stack>
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
}: {
  swapToken: ISwapToken;
  inputDraft?: ISwapInputAmountDraft;
  onInputDraftChange: (draft: ISwapInputAmountDraft) => void;
}) {
  // The content mounts only after the route token is execution-ready. Keep
  // that first complete token as the visual and initialization seed so detail
  // polling cannot replace its image source or reinitialize the embedded pair.
  const [swapTokenSeed] = useState(swapToken);
  // Consume the route's draft once per mount; live input must not reinitialize Swap.
  const [initialInputAmountDraft] = useState(inputDraft);
  const { defaultTokens } = useSpeedSwapInit(swapTokenSeed.networkId, true);
  const swapInitParams = useMemo<ISwapInitParams | undefined>(
    () =>
      buildMarketEmbeddedSwapInitParams({
        defaultTokens,
        inputDraft: initialInputAmountDraft,
        swapToken: swapTokenSeed,
      }),
    [defaultTokens, initialInputAmountDraft, swapTokenSeed],
  );

  if (!swapInitParams) {
    return <MarketEmbeddedSwapLoading />;
  }

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
        swapInitParams={swapInitParams}
        initialInputAmountDraft={initialInputAmountDraft}
        onInputDraftChange={onInputDraftChange}
      />
    </Stack>
  );
}

function MarketEmbeddedSwapDraft({
  swapToken,
  disabled,
}: {
  swapToken: ISwapToken;
  disabled?: boolean;
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

  // Keep only the draft while inactive, since other routes share the modal store.
  return disabled ? null : (
    <MarketEmbeddedSwapContent
      swapToken={swapToken}
      inputDraft={inputDraftRef.current}
      onInputDraftChange={onInputDraftChange}
    />
  );
}

export function MarketEmbeddedSwap({
  swapToken,
  inputDraftKey,
  disabled,
}: {
  swapToken: ISwapToken;
  inputDraftKey: string;
  disabled?: boolean;
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
      />
    </AccountSelectorProviderMirror>
  );
}
