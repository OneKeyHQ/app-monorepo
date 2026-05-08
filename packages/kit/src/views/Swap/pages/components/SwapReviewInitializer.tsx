import { type ReactNode, useEffect } from 'react';

import {
  useSwapBuildTxFetchingAtom,
  useSwapFromTokenAmountAtom,
  useSwapManualSelectQuoteProvidersAtom,
  useSwapQuoteListAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapStepNetFeeLevelAtom,
  useSwapStepsAtom,
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap/atoms';
import type { ICustomPriorityFeeOverride } from '@onekeyhq/shared/src/utils/marketPresetFeeUtils';
import {
  ESwapNetworkFeeLevel,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import type { ISwapReviewState } from '../../utils/swapReviewState';

type ISwapReviewInitializerProps = {
  children?: ReactNode;
  defaultNetworkFeeLevel?: ESwapNetworkFeeLevel;
  defaultCustomPriorityFee?: ICustomPriorityFeeOverride;
  reviewState: ISwapReviewState;
};

export function SwapReviewInitializer({
  children,
  defaultNetworkFeeLevel = ESwapNetworkFeeLevel.MEDIUM,
  defaultCustomPriorityFee,
  reviewState,
}: ISwapReviewInitializerProps) {
  const [, setSwapTypeSwitch] = useSwapTypeSwitchAtom();
  const [, setSwapSelectFromToken] = useSwapSelectFromTokenAtom();
  const [, setSwapSelectToToken] = useSwapSelectToTokenAtom();
  const [, setSwapFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [, setSwapToTokenAmount] = useSwapToTokenAmountAtom();
  const [, setSwapQuoteList] = useSwapQuoteListAtom();
  const [, setSwapManualSelectQuoteProviders] =
    useSwapManualSelectQuoteProvidersAtom();
  const [, setSwapSteps] = useSwapStepsAtom();
  const [, setSwapBuildTxFetching] = useSwapBuildTxFetchingAtom();
  const [, setSwapStepNetFeeLevel] = useSwapStepNetFeeLevelAtom();

  useEffect(() => {
    setSwapTypeSwitch(
      reviewState.preSwapData.swapType ?? ESwapTabSwitchType.SWAP,
    );
    setSwapSelectFromToken(reviewState.preSwapData.fromToken);
    setSwapSelectToToken(reviewState.preSwapData.toToken);
    setSwapFromTokenAmount({
      value: reviewState.preSwapData.fromTokenAmount ?? '',
      isInput: false,
    });
    setSwapToTokenAmount({
      value: reviewState.preSwapData.toTokenAmount ?? '',
      isInput: false,
    });
    setSwapQuoteList(reviewState.quoteResult ? [reviewState.quoteResult] : []);
    setSwapManualSelectQuoteProviders(undefined);
    setSwapSteps({
      steps: reviewState.steps,
      preSwapData: reviewState.preSwapData,
      quoteResult: reviewState.quoteResult,
    });
    setSwapBuildTxFetching(false);
    setSwapStepNetFeeLevel({
      networkFeeLevel: defaultNetworkFeeLevel,
      customPriorityFee: defaultCustomPriorityFee,
    });

    return () => {
      setSwapTypeSwitch(ESwapTabSwitchType.SWAP);
      setSwapSelectFromToken(undefined);
      setSwapSelectToToken(undefined);
      setSwapFromTokenAmount({
        value: '',
        isInput: false,
      });
      setSwapToTokenAmount({
        value: '',
        isInput: false,
      });
      setSwapQuoteList([]);
      setSwapManualSelectQuoteProviders(undefined);
      setSwapSteps({
        steps: [],
        preSwapData: {},
      });
      setSwapBuildTxFetching(false);
      setSwapStepNetFeeLevel({
        networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM,
      });
    };
  }, [
    defaultCustomPriorityFee,
    defaultNetworkFeeLevel,
    reviewState.preSwapData,
    reviewState.quoteResult,
    reviewState.steps,
    setSwapBuildTxFetching,
    setSwapFromTokenAmount,
    setSwapManualSelectQuoteProviders,
    setSwapQuoteList,
    setSwapSelectFromToken,
    setSwapSelectToToken,
    setSwapStepNetFeeLevel,
    setSwapSteps,
    setSwapToTokenAmount,
    setSwapTypeSwitch,
  ]);

  return children;
}
