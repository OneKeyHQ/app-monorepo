import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Spinner, YStack } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  ProviderJotaiContextSwap,
  useSwapFromTokenAmountAtom,
  useSwapQuoteListAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapStepsAtom,
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import TransactionLossNetworkFeeExceedDialog from '@onekeyhq/kit/src/views/Swap/components/TransactionLossNetworkFeeExceedDialog';
import { useSwapAddressInfo } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapAccount';
import { useSwapBuildTx } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapBuiltTx';
import {
  ESwapBatchTransferType,
  useSwapBatchTransferType,
} from '@onekeyhq/kit/src/views/Swap/hooks/useSwapState';
import PreSwapDialogContent from '@onekeyhq/kit/src/views/Swap/pages/components/PreSwapDialogContent';
import { useSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapDirectionType,
  ESwapSlippageSegmentKey,
  ESwapTabSwitchType,
  SwapBuildUseMultiplePopoversNetworkIds,
} from '@onekeyhq/shared/types/swap/types';

import { buildMarketSwapReviewState } from '../utils/reviewUtils';

function MarketSwapReviewDialogContentInner({
  onDone,
  quoteResult,
  slippage,
}: {
  onDone: () => void;
  quoteResult: IFetchQuoteResult;
  slippage: number;
}) {
  const intl = useIntl();
  const { updateSelectedAccountNetwork } = useAccountSelectorActions().current;
  const [, setSwapTypeSwitch] = useSwapTypeSwitchAtom();
  const [, setSwapSelectFromToken] = useSwapSelectFromTokenAtom();
  const [, setSwapSelectToToken] = useSwapSelectToTokenAtom();
  const [, setSwapFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [, setSwapToTokenAmount] = useSwapToTokenAmountAtom();
  const [, setSwapQuoteList] = useSwapQuoteListAtom();
  const [, setSwapSteps] = useSwapStepsAtom();
  const [settings, setSettings] = useSettingsAtom();
  const initialSettingsRef = useRef({
    swapSlippagePercentageCustomValue:
      settings.swapSlippagePercentageCustomValue,
    swapSlippagePercentageMode: settings.swapSlippagePercentageMode,
    swapToAnotherAccountSwitchOn: settings.swapToAnotherAccountSwitchOn,
  });
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const swapToAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  const initialAccountNetworkRef = useRef({
    fromNetworkId: swapFromAddressInfo.networkId,
    toNetworkId: swapToAddressInfo.networkId,
  });
  const [accountSelectorSynced, setAccountSelectorSynced] = useState(false);
  const [reviewStateSeeded, setReviewStateSeeded] = useState(false);
  const { preSwapBeforeStepActions, preSwapStepsStart } = useSwapBuildTx();
  const formatMessage = useCallback(
    (
      descriptor: {
        id: ETranslations;
      },
      values?: Record<string, string | number>,
    ) => String(intl.formatMessage(descriptor, values)),
    [intl],
  );

  const swapBatchTransferType = useSwapBatchTransferType(
    quoteResult.fromTokenInfo.networkId,
    swapFromAddressInfo.accountInfo?.account?.id,
    quoteResult.providerDisableBatchTransfer,
    Boolean(quoteResult.swapShouldSignedData),
    Boolean(quoteResult.allowanceResult),
  );

  const shouldSignEveryTime = useMemo(() => {
    const accountId = swapFromAddressInfo.accountInfo?.account?.id ?? '';
    const isExternalAccount = accountUtils.isExternalAccount({
      accountId,
    });
    const isHDAccount = accountUtils.isHwOrQrAccount({
      accountId,
    });
    return (
      (isExternalAccount || isHDAccount) && Boolean(quoteResult.allowanceResult)
    );
  }, [
    quoteResult.allowanceResult,
    swapFromAddressInfo.accountInfo?.account?.id,
  ]);

  const supportPreBuild = useMemo(() => {
    if (quoteResult.isWrapped) {
      return false;
    }
    if (!quoteResult.allowanceResult) {
      return true;
    }
    return !(
      quoteResult.providerDisableBatchTransfer ||
      SwapBuildUseMultiplePopoversNetworkIds.includes(
        quoteResult.fromTokenInfo.networkId,
      )
    );
  }, [
    quoteResult.allowanceResult,
    quoteResult.fromTokenInfo.networkId,
    quoteResult.isWrapped,
    quoteResult.providerDisableBatchTransfer,
  ]);

  const needFetchGas = useMemo(() => {
    if (!quoteResult.allowanceResult) {
      return false;
    }

    return ![
      ESwapBatchTransferType.BATCH_APPROVE_AND_SWAP,
      ESwapBatchTransferType.CONTINUOUS_APPROVE_AND_SWAP,
    ].includes(swapBatchTransferType);
  }, [quoteResult.allowanceResult, swapBatchTransferType]);

  const reviewState = useMemo(
    () =>
      buildMarketSwapReviewState({
        formatMessage,
        fromToken: quoteResult.fromTokenInfo,
        fromTokenAmount: quoteResult.fromAmount ?? '',
        isHWAndExBatchTransfer: shouldSignEveryTime,
        needFetchGas,
        quoteResult,
        shouldFallback: false,
        slippage,
        supportPreBuild,
        swapBatchTransferType,
        toToken: quoteResult.toTokenInfo,
      }),
    [
      formatMessage,
      needFetchGas,
      quoteResult,
      shouldSignEveryTime,
      slippage,
      supportPreBuild,
      swapBatchTransferType,
    ],
  );

  useEffect(() => {
    setReviewStateSeeded(false);
    let cancelled = false;
    const initialSettings = initialSettingsRef.current;
    const initialAccountNetworks = initialAccountNetworkRef.current;

    setSwapTypeSwitch(ESwapTabSwitchType.SWAP);
    setSwapSelectFromToken(quoteResult.fromTokenInfo);
    setSwapSelectToToken(quoteResult.toTokenInfo);
    setSwapFromTokenAmount({
      value: reviewState.preSwapData.fromTokenAmount ?? '',
      isInput: true,
    });
    setSwapToTokenAmount({
      value: reviewState.preSwapData.toTokenAmount ?? '',
      isInput: false,
    });
    setSwapQuoteList([quoteResult]);
    setSettings((prev) => ({
      ...prev,
      swapSlippagePercentageMode: ESwapSlippageSegmentKey.CUSTOM,
      swapSlippagePercentageCustomValue: slippage,
      swapToAnotherAccountSwitchOn: false,
    }));

    void (async () => {
      await updateSelectedAccountNetwork({
        num: 0,
        networkId: quoteResult.fromTokenInfo.networkId,
      });
      await updateSelectedAccountNetwork({
        num: 1,
        networkId: quoteResult.toTokenInfo.networkId,
      });

      if (!cancelled) {
        setAccountSelectorSynced(true);
      }
    })();

    return () => {
      cancelled = true;
      const { fromNetworkId, toNetworkId } = initialAccountNetworks;
      if (fromNetworkId) {
        void updateSelectedAccountNetwork({
          num: 0,
          networkId: fromNetworkId,
        });
      }
      if (toNetworkId) {
        void updateSelectedAccountNetwork({
          num: 1,
          networkId: toNetworkId,
        });
      }
      setSwapQuoteList([]);
      setSwapSteps({
        steps: [],
        preSwapData: {},
      });
      setSwapFromTokenAmount({
        value: '',
        isInput: false,
      });
      setSwapToTokenAmount({
        value: '',
        isInput: false,
      });
      setSettings((prev) => ({
        ...prev,
        ...initialSettings,
      }));
    };
  }, [
    quoteResult,
    reviewState.preSwapData.fromTokenAmount,
    reviewState.preSwapData.toTokenAmount,
    setSettings,
    setSwapFromTokenAmount,
    setSwapQuoteList,
    setSwapSelectFromToken,
    setSwapSelectToToken,
    setSwapSteps,
    setSwapToTokenAmount,
    setSwapTypeSwitch,
    slippage,
    updateSelectedAccountNetwork,
  ]);

  const isSwapContextReady = useMemo(() => {
    return (
      accountSelectorSynced &&
      swapFromAddressInfo.networkId === quoteResult.fromTokenInfo.networkId &&
      swapToAddressInfo.networkId === quoteResult.toTokenInfo.networkId &&
      !!swapFromAddressInfo.address &&
      !!swapToAddressInfo.address
    );
  }, [
    accountSelectorSynced,
    quoteResult.fromTokenInfo.networkId,
    quoteResult.toTokenInfo.networkId,
    swapFromAddressInfo.address,
    swapFromAddressInfo.networkId,
    swapToAddressInfo.address,
    swapToAddressInfo.networkId,
  ]);

  useEffect(() => {
    if (!isSwapContextReady) {
      setReviewStateSeeded(false);
      return;
    }

    setSwapSteps(reviewState);
    setReviewStateSeeded(true);
  }, [isSwapContextReady, reviewState, setSwapSteps]);

  const handleConfirm = useCallback(() => {
    if (quoteResult.networkCostExceedInfo && !quoteResult.allowanceResult) {
      Dialog.confirm({
        title: intl.formatMessage({
          id: ETranslations.swap_network_cost_dialog_title,
        }),
        description: intl.formatMessage(
          {
            id: ETranslations.swap_network_cost_dialog_description,
          },
          {
            number: ` ${quoteResult.networkCostExceedInfo.exceedPercent}%`,
          },
        ),
        renderContent: (
          <TransactionLossNetworkFeeExceedDialog
            protocol={quoteResult.protocol ?? EProtocolOfExchange.SWAP}
            networkCostExceedInfo={quoteResult.networkCostExceedInfo}
          />
        ),
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_continue,
        }),
        onConfirm: () => {
          void preSwapStepsStart();
        },
      });
      return;
    }

    void preSwapStepsStart();
  }, [intl, preSwapStepsStart, quoteResult]);

  if (!isSwapContextReady || !reviewStateSeeded) {
    return (
      <YStack py="$10" alignItems="center" justifyContent="center">
        <Spinner />
      </YStack>
    );
  }

  return (
    <PreSwapDialogContent
      preSwapBeforeStepActions={preSwapBeforeStepActions}
      preSwapStepsStart={preSwapStepsStart}
      onConfirm={handleConfirm}
      onDone={onDone}
    />
  );
}

export function MarketSwapReviewDialogContent({
  onDone,
  quoteResult,
  slippage,
}: {
  onDone: () => void;
  quoteResult: IFetchQuoteResult;
  slippage: number;
}) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.swap,
        sceneUrl: '',
      }}
      enabledNum={[0, 1]}
    >
      <ProviderJotaiContextSwap>
        <MarketSwapReviewDialogContentInner
          onDone={onDone}
          quoteResult={quoteResult}
          slippage={slippage}
        />
      </ProviderJotaiContextSwap>
    </AccountSelectorProviderMirror>
  );
}
