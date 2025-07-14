import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { Button, Dialog, DialogContainer } from '@onekeyhq/components';
import {
  useSwapFromTokenAmountAtom,
  useSwapLimitPriceUseRateAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapStepsAtom,
  useSwapToTokenAmountAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import {
  EProtocolOfExchange,
  type IFetchQuoteResult,
  LIMIT_PRICE_DEFAULT_DECIMALS,
} from '@onekeyhq/shared/types/swap/types';

import TransactionLossNetworkFeeExceedDialog from '../../components/TransactionLossNetworkFeeExceedDialog';
import { useSwapSlippagePercentageModeInfo } from '../../hooks/useSwapState';

import PreSwapDialogContent from './PreSwapDialogContent';

interface IPreSwapDialogContainerProps {
  onPreSwapStepsStart: () => void;
  onClose: () => void;
  open: boolean;
}

const PreSwapDialogContainer = ({
  onPreSwapStepsStart,
  open,
  onClose,
}: IPreSwapDialogContainerProps) => {
  const [swapToAmount] = useSwapToTokenAmountAtom();
  const [swapLimitUseRate] = useSwapLimitPriceUseRateAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [fromAmount] = useSwapFromTokenAmountAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [currentQuoteRes] = useSwapQuoteCurrentSelectAtom();
  const { slippageItem } = useSwapSlippagePercentageModeInfo();
  const [swapSteps] = useSwapStepsAtom();
  const intl = useIntl();
  const onActionHandler = useCallback(() => {
    if (swapSteps.length > 0) {
      const firstStep = swapSteps[0];
      if (firstStep.isResetApprove) {
        Dialog.confirm({
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_continue,
          }),
          onConfirm: () => {
            onPreSwapStepsStart();
          },
          showCancelButton: true,
          title: intl.formatMessage({
            id: ETranslations.swap_page_provider_approve_usdt_dialog_title,
          }),
          description: intl.formatMessage({
            id: ETranslations.swap_page_provider_approve_usdt_dialog_content,
          }),
          icon: 'ErrorOutline',
        });
      } else {
        onPreSwapStepsStart();
      }
    }
  }, [intl, onPreSwapStepsStart, swapSteps]);

  const onActionHandlerBefore = useCallback(() => {
    if (currentQuoteRes?.quoteShowTip) {
      Dialog.confirm({
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_continue,
        }),
        onConfirm: () => {
          onActionHandler();
        },
        title: currentQuoteRes?.quoteShowTip.title ?? '',
        description: currentQuoteRes.quoteShowTip.detail ?? '',
        icon:
          (currentQuoteRes?.quoteShowTip.icon as IKeyOfIcons) ??
          'ChecklistBoxOutline',
        renderContent: currentQuoteRes.quoteShowTip?.link ? (
          <Button
            variant="tertiary"
            size="small"
            alignSelf="flex-start"
            icon="QuestionmarkOutline"
            onPress={() => {
              if (currentQuoteRes.quoteShowTip?.link) {
                openUrlExternal(currentQuoteRes.quoteShowTip?.link);
              }
            }}
          >
            {intl.formatMessage({ id: ETranslations.global_learn_more })}
          </Button>
        ) : undefined,
      });
    } else if (
      currentQuoteRes?.networkCostExceedInfo &&
      !currentQuoteRes.allowanceResult
    ) {
      let percentage = currentQuoteRes.networkCostExceedInfo?.exceedPercent;
      const netCost = new BigNumber(
        currentQuoteRes.networkCostExceedInfo?.cost ?? '0',
      );
      if (
        currentQuoteRes.protocol === EProtocolOfExchange.LIMIT &&
        netCost.gt(0)
      ) {
        let toRealAmount = new BigNumber(0);
        const fromAmountBN = new BigNumber(fromAmount.value);
        const toAmountBN = new BigNumber(swapToAmount.value);
        if (!toAmountBN.isNaN() && !toAmountBN.isZero()) {
          toRealAmount = new BigNumber(swapToAmount.value);
        } else if (
          !fromAmountBN.isNaN() &&
          !fromAmountBN.isZero() &&
          swapLimitUseRate.rate
        ) {
          const cToAmountBN = new BigNumber(fromAmountBN).multipliedBy(
            new BigNumber(swapLimitUseRate.rate),
          );
          toRealAmount = cToAmountBN.decimalPlaces(
            toToken?.decimals ?? LIMIT_PRICE_DEFAULT_DECIMALS,
            BigNumber.ROUND_HALF_UP,
          );
        }
        const calculateNetworkCostExceedPercent =
          netCost.dividedBy(toRealAmount);
        if (calculateNetworkCostExceedPercent.lte(new BigNumber(0.1))) {
          onActionHandler();
          return;
        }
        percentage = calculateNetworkCostExceedPercent
          .multipliedBy(100)
          .toFixed(2);
      }
      Dialog.confirm({
        title: intl.formatMessage({
          id: ETranslations.swap_network_cost_dialog_title,
        }),
        description: intl.formatMessage(
          {
            id: ETranslations.swap_network_cost_dialog_description,
          },
          {
            number: ` ${percentage}%`,
          },
        ),
        renderContent: (
          <TransactionLossNetworkFeeExceedDialog
            protocol={currentQuoteRes.protocol ?? EProtocolOfExchange.SWAP}
            networkCostExceedInfo={{
              ...currentQuoteRes.networkCostExceedInfo,
              exceedPercent: percentage,
            }}
          />
        ),
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_continue,
        }),
        onConfirm: () => {
          onActionHandler();
        },
      });
    } else {
      onActionHandler();
    }
  }, [
    currentQuoteRes?.allowanceResult,
    currentQuoteRes?.networkCostExceedInfo,
    currentQuoteRes?.protocol,
    currentQuoteRes?.quoteShowTip,
    intl,
    onActionHandler,
    swapLimitUseRate.rate,
    fromAmount.value,
    swapToAmount.value,
    toToken?.decimals,
  ]);

  const handleConfirm = useCallback(async () => {
    onActionHandlerBefore();
  }, [onActionHandlerBefore]);

  const handleClose = useCallback(async () => {
    onClose();
  }, [onClose]);

  return (
    <DialogContainer
      open={open}
      onClose={handleClose}
      title="Review swap"
      showFooter={false}
      renderContent={
        <PreSwapDialogContent
          fromTokenInfo={fromToken}
          toTokenInfo={toToken}
          quoteResult={currentQuoteRes as IFetchQuoteResult}
          onConfirm={handleConfirm}
          slippageItem={slippageItem}
        />
      }
    />
  );
};

export default PreSwapDialogContainer;
