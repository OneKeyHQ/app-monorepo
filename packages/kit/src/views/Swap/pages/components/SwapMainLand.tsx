import { useCallback, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { EPageType, ScrollView, YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useSwapActions,
  useSwapAlertsAtom,
  useSwapFromTokenAmountAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapQuoteIntervalCountAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectedFromTokenBalanceAtom,
  useSwapShouldRefreshQuoteAtom,
  useSwapStepsAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import {
  EJotaiContextStoreNames,
  useInAppNotificationAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import {
  EModalSwapRoutes,
  type IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import { checkWrappedTokenPair } from '@onekeyhq/shared/src/utils/tokenUtils';
import { swapApproveResetValue } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  IFetchQuoteResult,
  ISwapInitParams,
  ISwapStep,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapDirectionType,
  ESwapQuoteKind,
  ESwapSelectTokenSource,
  ESwapStepStatus,
  ESwapStepType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import SwapRecentTokenPairsGroup from '../../components/SwapRecentTokenPairsGroup';
import { useSwapAddressInfo } from '../../hooks/useSwapAccount';
import { useSwapBuildTx } from '../../hooks/useSwapBuiltTx';
import { useSwapInit } from '../../hooks/useSwapGlobal';
import {
  ESwapBatchTransferType,
  useSwapBatchTransferType,
  useSwapQuoteEventFetching,
  useSwapQuoteLoading,
  useSwapSlippagePercentageModeInfo,
} from '../../hooks/useSwapState';
import { SwapProviderMirror } from '../SwapProviderMirror';

import LimitInfoContainer from './LimitInfoContainer';
import LimitOrderOpenItem from './LimitOrderOpenItem';
import PreSwapDialogContainer from './PreSwapDialogContainer';
import SwapActionsState from './SwapActionsState';
import SwapAlertContainer from './SwapAlertContainer';
import SwapHeaderContainer from './SwapHeaderContainer';
import SwapQuoteInput from './SwapQuoteInput';
import SwapQuoteResult from './SwapQuoteResult';
import SwapTipsContainer from './SwapTipsContainer';

interface ISwapMainLoadProps {
  children?: React.ReactNode;
  swapInitParams?: ISwapInitParams;
  pageType?: EPageType.modal;
}

const SwapMainLoad = ({ swapInitParams, pageType }: ISwapMainLoadProps) => {
  const { buildTx, approveTx, wrappedTx } = useSwapBuildTx();
  const { fetchLoading } = useSwapInit(swapInitParams);
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const [quoteResult] = useSwapQuoteCurrentSelectAtom();
  const [alerts] = useSwapAlertsAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const toAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const quoteLoading = useSwapQuoteLoading();
  const quoteEventFetching = useSwapQuoteEventFetching();
  const [{ swapRecentTokenPairs }] = useInAppNotificationAtom();
  const [fromTokenAmount, setFromInputAmount] = useSwapFromTokenAmountAtom();
  const [, setSwapQuoteIntervalCount] = useSwapQuoteIntervalCountAtom();
  const { selectFromToken, selectToToken, quoteAction, cleanQuoteInterval } =
    useSwapActions().current;
  const [fromTokenBalance] = useSwapSelectedFromTokenBalanceAtom();
  const [, setSwapShouldRefreshQuote] = useSwapShouldRefreshQuoteAtom();
  const [fromSelectToken] = useSwapSelectFromTokenAtom();
  const [toSelectToken] = useSwapSelectToTokenAtom();
  const { slippageItem } = useSwapSlippagePercentageModeInfo();
  const [currentQuoteRes] = useSwapQuoteCurrentSelectAtom();
  const [swapSteps, setSwapSteps] = useSwapStepsAtom();
  const swapSlippageRef = useRef(slippageItem);
  if (swapSlippageRef.current !== slippageItem) {
    swapSlippageRef.current = slippageItem;
  }

  const storeName = useMemo(
    () =>
      pageType === EPageType.modal
        ? EJotaiContextStoreNames.swapModal
        : EJotaiContextStoreNames.swap,
    [pageType],
  );

  const onSelectToken = useCallback(
    (type: ESwapDirectionType) => {
      navigation.pushModal(EModalRoutes.SwapModal, {
        screen: EModalSwapRoutes.SwapTokenSelect,
        params: {
          type,
          storeName,
        },
      });
    },
    [navigation, storeName],
  );
  const onSelectRecentTokenPairs = useCallback(
    ({
      fromToken,
      toToken,
    }: {
      fromToken: ISwapToken;
      toToken: ISwapToken;
    }) => {
      void selectFromToken(fromToken, true);
      void selectToToken(toToken);
      defaultLogger.swap.selectToken.selectToken({
        selectFrom: ESwapSelectTokenSource.RECENT_SELECT,
      });
    },
    [selectFromToken, selectToToken],
  );
  const onOpenProviderList = useCallback(() => {
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapProviderSelect,
      params: {
        storeName,
      },
    });
  }, [navigation, storeName]);

  const onToAnotherAddressModal = useCallback(() => {
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapToAnotherAddress,
      params: {
        address: toAddressInfo.address,
        storeName,
      },
    });
  }, [navigation, storeName, toAddressInfo.address]);

  const onBuildTx = useCallback(async () => {
    await buildTx();
  }, [buildTx]);

  const onApprove = useCallback(
    async (amount: string, isMax?: boolean, shoutResetApprove?: boolean) => {
      if (shoutResetApprove) {
        await approveTx(swapApproveResetValue, isMax, amount);
      } else {
        await approveTx(amount, isMax);
      }
    },
    [approveTx],
  );

  const refreshAction = useCallback(
    (manual?: boolean) => {
      if (manual) {
        void quoteAction(
          swapSlippageRef.current,
          swapFromAddressInfo?.address,
          swapFromAddressInfo?.accountInfo?.account?.id,
          undefined,
          undefined,
          quoteResult?.kind ?? ESwapQuoteKind.SELL,
          undefined,
          toAddressInfo?.address,
        );
      } else {
        setSwapQuoteIntervalCount((v) => v + 1);
        void quoteAction(
          swapSlippageRef.current,
          swapFromAddressInfo?.address,
          swapFromAddressInfo?.accountInfo?.account?.id,
          undefined,
          true,
          quoteResult?.kind ?? ESwapQuoteKind.SELL,
          undefined,
          toAddressInfo?.address,
        );
      }
    },
    [
      quoteAction,
      swapFromAddressInfo?.address,
      swapFromAddressInfo?.accountInfo?.account?.id,
      quoteResult?.kind,
      setSwapQuoteIntervalCount,
      toAddressInfo?.address,
    ],
  );

  const onWrapped = useCallback(async () => {
    await wrappedTx();
  }, [wrappedTx]);

  const onSelectPercentageStage = useCallback(
    (stage: number) => {
      const fromTokenBalanceBN = new BigNumber(fromTokenBalance ?? 0);
      const amountBN = fromTokenBalanceBN.multipliedBy(stage / 100);
      const amountAfterDecimal = amountBN.decimalPlaces(
        fromSelectToken?.decimals ?? 6,
        BigNumber.ROUND_DOWN,
      );
      if (
        !amountAfterDecimal.isNaN() &&
        validateAmountInput(
          amountAfterDecimal.toFixed(),
          fromSelectToken?.decimals,
        )
      ) {
        setFromInputAmount({
          value: amountAfterDecimal.toFixed(),
          isInput: true,
        });
      }
    },
    [fromTokenBalance, fromSelectToken?.decimals, setFromInputAmount],
  );
  const isWrapped = useMemo(
    () =>
      checkWrappedTokenPair({
        fromToken: fromSelectToken,
        toToken: toSelectToken,
      }),
    [fromSelectToken, toSelectToken],
  );
  const [preSwapDialogOpen, setPreSwapDialogOpen] = useState(false);
  const swapBatchTransferType = useSwapBatchTransferType(
    swapFromAddressInfo.networkId,
    swapFromAddressInfo.accountInfo?.account?.id,
    currentQuoteRes?.providerDisableBatchTransfer,
  );
  const parseQuoteResultToSteps = useCallback(
    (quoteRes: IFetchQuoteResult) => {
      let steps: ISwapStep[] = [];
      if (quoteRes.isWrapped) {
        steps = [
          {
            type: ESwapStepType.WRAP_TX,
            status: ESwapStepStatus.READY,
            data: quoteRes,
          },
        ];
      } else if (quoteRes.swapShouldSignedData) {
        steps = [
          {
            type: ESwapStepType.SIGN_MESSAGE,
            status: ESwapStepStatus.READY,
            data: quoteRes,
          },
          {
            type: ESwapStepType.SEND_TX,
            status: ESwapStepStatus.READY,
            data: quoteRes,
            skipSendTransAction: true,
          },
        ];
      } else if (
        swapBatchTransferType === ESwapBatchTransferType.BATCH_APPROVE_AND_SWAP
      ) {
        steps = [
          {
            type: ESwapStepType.BATCH_APPROVE_SWAP,
            status: ESwapStepStatus.READY,
            data: quoteRes,
          },
        ];

        console.log('swap__pre batch approve and swap');
      } else {
        if (quoteRes.allowanceResult) {
          steps = [
            {
              type: ESwapStepType.APPROVE_TX,
              status: ESwapStepStatus.READY,
              data: quoteRes,
              canRetry: true,
              shouldWaitApproved:
                swapBatchTransferType !==
                ESwapBatchTransferType.CONTINUOUS_APPROVE_AND_SWAP,
            },
          ];
        }
        steps = [
          ...steps,
          {
            type: ESwapStepType.SEND_TX,
            status: ESwapStepStatus.READY,
            data: quoteRes,
          },
        ];
        console.log('swap__pre continuous approve and swap');
      }
      setSwapSteps([...steps]);
    },
    [swapBatchTransferType, setSwapSteps],
  );

  const onPreSwap = useCallback(() => {
    if (!currentQuoteRes) {
      return;
    }
    cleanQuoteInterval();
    setSwapShouldRefreshQuote(true);
    setPreSwapDialogOpen(true);
    parseQuoteResultToSteps(currentQuoteRes);
  }, [
    cleanQuoteInterval,
    setSwapShouldRefreshQuote,
    parseQuoteResultToSteps,
    currentQuoteRes,
  ]);
  return (
    <ScrollView>
      <YStack
        testID="swap-content-container"
        flex={1}
        marginHorizontal="auto"
        width="100%"
        maxWidth={pageType === EPageType.modal ? '100%' : 500}
      >
        <YStack
          pt="$2.5"
          px="$5"
          pb="$5"
          gap="$5"
          flex={1}
          $gtMd={{
            flex: 'unset',
            pt: pageType === EPageType.modal ? '$2.5' : '$5',
          }}
        >
          <SwapTipsContainer />
          <SwapHeaderContainer
            pageType={pageType}
            defaultSwapType={swapInitParams?.swapTabSwitchType}
          />
          <LimitOrderOpenItem storeName={storeName} />
          <SwapQuoteInput
            onSelectToken={onSelectToken}
            selectLoading={fetchLoading}
            onSelectPercentageStage={onSelectPercentageStage}
          />
          {swapTypeSwitch === ESwapTabSwitchType.LIMIT && !isWrapped ? (
            <LimitInfoContainer />
          ) : null}
          <SwapActionsState
            onPreSwap={onPreSwap}
            onOpenRecipientAddress={onToAnotherAddressModal}
            onSelectPercentageStage={onSelectPercentageStage}
          />
          <SwapQuoteResult
            refreshAction={refreshAction}
            onOpenProviderList={onOpenProviderList}
            quoteResult={quoteResult}
            onOpenRecipient={onToAnotherAddressModal}
          />
          {alerts.states.length > 0 &&
          !quoteLoading &&
          !quoteEventFetching &&
          alerts?.quoteId === (quoteResult?.quoteId ?? '') ? (
            <SwapAlertContainer alerts={alerts.states} />
          ) : null}
          <SwapRecentTokenPairsGroup
            onSelectTokenPairs={onSelectRecentTokenPairs}
            tokenPairs={swapRecentTokenPairs}
            fromTokenAmount={fromTokenAmount.value}
          />
          <PreSwapDialogContainer
            onClose={() => {
              console.log('swap__pre onClose');
              setPreSwapDialogOpen(false);
              setSwapSteps([]);
            }}
            open={preSwapDialogOpen}
            onBuildTx={onBuildTx}
            onApprove={onApprove}
            onWrapped={onWrapped}
          />
        </YStack>
      </YStack>
    </ScrollView>
  );
};

const SwapMainLandWithPageType = (props: ISwapMainLoadProps) => (
  <SwapProviderMirror
    storeName={
      props?.pageType === EPageType.modal
        ? EJotaiContextStoreNames.swapModal
        : EJotaiContextStoreNames.swap
    }
  >
    <SwapMainLoad {...props} pageType={props?.pageType} />
  </SwapProviderMirror>
);

export default SwapMainLandWithPageType;
