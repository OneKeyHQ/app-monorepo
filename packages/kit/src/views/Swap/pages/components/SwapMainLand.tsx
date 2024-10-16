import { useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { EPageType, ScrollView, YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useSwapActions,
  useSwapAlertsAtom,
  useSwapFromTokenAmountAtom,
  useSwapQuoteCurrentSelectAtom,
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
// import { useSwapAddressInfo } from '../../hooks/useSwapAccount';
import { useSwapAddressInfo } from '../../hooks/useSwapAccount';
import { useSwapBuildTx } from '../../hooks/useSwapBuiltTx';
import {
  useSwapQuoteEventFetching,
  useSwapQuoteLoading,
} from '../../hooks/useSwapState';
import { useSwapInit } from '../../hooks/useSwapTokens';
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
  const quoteLoading = useSwapQuoteLoading();
  const quoteEventFetching = useSwapQuoteEventFetching();
  const [{ swapRecentTokenPairs }] = useInAppNotificationAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const { selectFromToken, selectToToken } = useSwapActions().current;
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

  const onWrapped = useCallback(async () => {
    await wrappedTx();
  }, [wrappedTx]);

  return (
    <ScrollView>
      <YStack
        testID="swap-content-container"
        flex={1}
        marginHorizontal="auto"
        width="100%"
        maxWidth={pageType === EPageType.modal ? '100%' : 480}
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
            defaultSwapType={swapInitParams?.swapTabSwitchType}
          />
          <SwapQuoteInput
            onSelectToken={onSelectToken}
            selectLoading={fetchLoading}
          />
          <SwapQuoteResult
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
        <SwapActionsState
          onBuildTx={onBuildTx}
          onApprove={onApprove}
          onWrapped={onWrapped}
        />
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
    <SwapMainLoad {...props} />
  </SwapProviderMirror>
);

export default SwapMainLandWithPageType;
