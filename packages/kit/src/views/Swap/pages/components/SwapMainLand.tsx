import { useCallback, useRef } from 'react';

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
  useSwapSelectedFromTokenBalanceAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import {
  EJotaiContextStoreNames,
  useInAppNotificationAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import {
  EModalSwapRoutes,
  type IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import { swapApproveResetValue } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  ISwapInitParams,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import SwapRecentTokenPairsGroup from '../../components/SwapRecentTokenPairsGroup';
import { useSwapAddressInfo } from '../../hooks/useSwapAccount';
import { useSwapBuildTx } from '../../hooks/useSwapBuiltTx';
import {
  useSwapQuoteEventFetching,
  useSwapQuoteLoading,
  useSwapSlippagePercentageModeInfo,
} from '../../hooks/useSwapState';
import { useSwapInit } from '../../hooks/useSwapTokens';
import { validateAmountInput } from '../../utils/utils';
import { SwapProviderMirror } from '../SwapProviderMirror';

import SwapActionsState from './SwapActionsState';
import SwapAlertContainer from './SwapAlertContainer';
import SwapHeaderContainer from './SwapHeaderContainer';
import SwapQuoteInput from './SwapQuoteInput';
import SwapQuoteResult from './SwapQuoteResult';

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
  const toAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const quoteLoading = useSwapQuoteLoading();
  const quoteEventFetching = useSwapQuoteEventFetching();
  const [{ swapRecentTokenPairs }] = useInAppNotificationAtom();
  const [fromTokenAmount, setFromInputAmount] = useSwapFromTokenAmountAtom();
  const [, setSwapQuoteIntervalCount] = useSwapQuoteIntervalCountAtom();
  const { selectFromToken, selectToToken, quoteAction } =
    useSwapActions().current;
  const [fromTokenBalance] = useSwapSelectedFromTokenBalanceAtom();
  const [fromSelectToken] = useSwapSelectFromTokenAtom();
  const { slippageItem } = useSwapSlippagePercentageModeInfo();
  const swapSlippageRef = useRef(slippageItem);
  if (swapSlippageRef.current !== slippageItem) {
    swapSlippageRef.current = slippageItem;
  }
  const onSelectToken = useCallback(
    (type: ESwapDirectionType) => {
      navigation.pushModal(EModalRoutes.SwapModal, {
        screen: EModalSwapRoutes.SwapTokenSelect,
        params: {
          type,
          storeName:
            pageType === EPageType.modal
              ? EJotaiContextStoreNames.swapModal
              : EJotaiContextStoreNames.swap,
        },
      });
    },
    [navigation, pageType],
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
    },
    [selectFromToken, selectToToken],
  );
  const onOpenProviderList = useCallback(() => {
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapProviderSelect,
      params: {
        storeName:
          pageType === EPageType.modal
            ? EJotaiContextStoreNames.swapModal
            : EJotaiContextStoreNames.swap,
      },
    });
  }, [navigation, pageType]);

  const onToAnotherAddressModal = useCallback(() => {
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapToAnotherAddress,
      params: {
        address: toAddressInfo.address,
        storeName:
          pageType === EPageType.modal
            ? EJotaiContextStoreNames.swapModal
            : EJotaiContextStoreNames.swap,
      },
    });
  }, [navigation, pageType, toAddressInfo.address]);

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
        );
      } else {
        setSwapQuoteIntervalCount((v) => v + 1);
        void quoteAction(
          swapSlippageRef.current,
          swapFromAddressInfo?.address,
          swapFromAddressInfo?.accountInfo?.account?.id,
          undefined,
          true,
        );
      }
    },
    [
      quoteAction,
      swapFromAddressInfo?.accountInfo?.account?.id,
      swapFromAddressInfo?.address,
      setSwapQuoteIntervalCount,
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
        setFromInputAmount(amountAfterDecimal.toFixed());
      }
    },
    [fromTokenBalance, fromSelectToken?.decimals, setFromInputAmount],
  );

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
          <SwapHeaderContainer
            pageType={pageType}
            defaultSwapType={swapInitParams?.swapTabSwitchType}
          />
          <SwapQuoteInput
            onSelectToken={onSelectToken}
            selectLoading={fetchLoading}
            onSelectPercentageStage={onSelectPercentageStage}
          />
          <SwapActionsState
            onBuildTx={onBuildTx}
            onApprove={onApprove}
            onWrapped={onWrapped}
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
          alerts.quoteId === (quoteResult?.quoteId ?? '') ? (
            <SwapAlertContainer alerts={alerts.states} />
          ) : null}
          <SwapRecentTokenPairsGroup
            onSelectTokenPairs={onSelectRecentTokenPairs}
            tokenPairs={swapRecentTokenPairs}
            fromTokenAmount={fromTokenAmount}
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
