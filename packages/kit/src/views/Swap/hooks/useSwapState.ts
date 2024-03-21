import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import {
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import {
  ESwapAlertLevel,
  ESwapDirectionType,
} from '@onekeyhq/shared/types/swap/types';
import type {
  ISwapAlertState,
  ISwapState,
} from '@onekeyhq/shared/types/swap/types';

import {
  useSwapBuildTxFetchingAtom,
  useSwapFromTokenAmountAtom,
  useSwapQuoteApproveAllowanceUnLimitAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapQuoteFetchingAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectedFromTokenBalanceAtom,
} from '../../../states/jotai/contexts/swap';

import { useSwapAddressInfo } from './uswSwapAccount';

function useSwapWarningCheck() {
  const [fromToken] = useSwapSelectFromTokenAtom();
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const swapToAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [quoteResult] = useSwapQuoteCurrentSelectAtom();
  const [swapSelectFromTokenBalance] = useSwapSelectedFromTokenBalanceAtom();

  const checkSwapWarning = useCallback(() => {
    let alerts: ISwapAlertState[] = [];
    // check account
    if (!swapFromAddressInfo.accountInfo) {
      alerts = [
        ...alerts,
        {
          message: 'No connected wallet.',
          alertLevel: ESwapAlertLevel.ERROR,
        },
      ];
    }

    if (
      fromToken &&
      !swapFromAddressInfo.address &&
      swapFromAddressInfo.accountInfo?.wallet?.type === WALLET_TYPE_IMPORTED
    ) {
      alerts = [
        ...alerts,
        {
          message: `The connected wallet do not support ${
            swapFromAddressInfo.accountInfo?.network?.name ?? 'unknown'
          }. Try switching to another one.`,
          alertLevel: ESwapAlertLevel.ERROR,
        },
      ];
    }

    if (
      toToken &&
      !swapToAddressInfo.address &&
      swapToAddressInfo.accountInfo?.wallet?.type === WALLET_TYPE_IMPORTED
    ) {
      alerts = [
        ...alerts,
        {
          message: `The connected wallet do not support ${
            swapToAddressInfo.accountInfo?.network?.name ?? 'unknown'
          }. Try switching to another one.`,
          alertLevel: ESwapAlertLevel.ERROR,
        },
      ];
    }

    if (
      fromToken &&
      swapFromAddressInfo.accountInfo?.wallet?.type === WALLET_TYPE_WATCHING
    ) {
      alerts = [
        ...alerts,
        {
          message: `The connected wallet do not support swap. Try switching to another one.`,
          alertLevel: ESwapAlertLevel.ERROR,
        },
      ];
    }

    if (
      fromToken &&
      !swapFromAddressInfo.address &&
      (swapFromAddressInfo.accountInfo?.wallet?.type === WALLET_TYPE_HD ||
        swapFromAddressInfo.accountInfo?.wallet?.type === WALLET_TYPE_HW)
    ) {
      alerts = [
        ...alerts,
        {
          message: `${
            swapFromAddressInfo.accountInfo?.wallet?.name ?? 'unknown'
          } - ${
            swapFromAddressInfo.accountInfo?.accountName ?? 'unknown'
          } does not have a ${
            swapFromAddressInfo.accountInfo.network?.name ?? 'unknown'
          } address. Please complete the creation.`,
          alertLevel: ESwapAlertLevel.ERROR,
        },
      ];
    }

    if (
      toToken &&
      !swapToAddressInfo.address &&
      (swapToAddressInfo.accountInfo?.wallet?.type === WALLET_TYPE_HD ||
        swapToAddressInfo.accountInfo?.wallet?.type === WALLET_TYPE_HW) &&
      swapFromAddressInfo.networkId !== swapToAddressInfo.networkId
    ) {
      alerts = [
        ...alerts,
        {
          message: `${
            swapToAddressInfo.accountInfo?.wallet?.name ?? 'unknown'
          } - ${
            swapToAddressInfo.accountInfo?.accountName ?? 'unknown'
          } does not have a ${
            swapToAddressInfo.accountInfo?.network?.name ?? 'unknown'
          } address. Please complete the creation.`,
          alertLevel: ESwapAlertLevel.ERROR,
        },
      ];
    }

    // provider toAmount check
    if (quoteResult && !quoteResult?.toAmount && !quoteResult?.limit) {
      alerts = [
        ...alerts,
        {
          message: 'No the third provider supports this trade.',
          alertLevel: ESwapAlertLevel.ERROR,
        },
      ];
    }

    // provider best check
    if (quoteResult?.toAmount && !quoteResult.isBest) {
      alerts = [
        ...alerts,
        {
          message:
            'The current provider does not offer the best rate for this trade.',
          alertLevel: ESwapAlertLevel.WARNING,
        },
      ];
    }

    // price check
    if ((fromToken && !fromToken?.price) || (toToken && !toToken?.price)) {
      alerts = [
        ...alerts,
        {
          message: `Failed to fetch ${
            !fromToken?.price
              ? fromToken?.name ?? fromToken?.symbol ?? 'unknown'
              : toToken?.name ?? toToken?.symbol ?? 'unknown'
          } price.You can still proceed with the trade.`,
          alertLevel: ESwapAlertLevel.WARNING,
        },
      ];
    }

    // market rate check
    if (fromToken && toToken && quoteResult?.instantRate) {
      const fromTokenPrice = new BigNumber(fromToken.price);
      const toTokenPrice = new BigNumber(toToken.price);
      const marketingRate = fromTokenPrice
        .dividedBy(toTokenPrice)
        .decimalPlaces(6);
      const quoteRateBN = new BigNumber(quoteResult.instantRate);
      const difference = marketingRate
        .dividedBy(quoteRateBN)
        .minus(1)
        .multipliedBy(100);
      if (quoteRateBN.isZero()) {
        alerts = [
          ...alerts,
          {
            message: `High price impact! A drop of more than 100% may result in loss of assets.`,
            alertLevel: ESwapAlertLevel.WARNING,
          },
        ];
      } else if (difference.comparedTo(5) === 1) {
        alerts = [
          ...alerts,
          {
            message: `High price impact! A drop of more than ${difference
              .decimalPlaces(2)
              .toFixed()}% may result in loss of assets.`,
            alertLevel: ESwapAlertLevel.WARNING,
          },
        ];
      }
    }

    const fromTokenAmountBN = new BigNumber(fromTokenAmount);
    // check min max amount
    if (quoteResult && quoteResult.limit?.min) {
      const minAmountBN = new BigNumber(quoteResult.limit.min);
      if (fromTokenAmountBN.lt(minAmountBN)) {
        alerts = [
          ...alerts,
          {
            message: `The minimum amount for this swap is ${minAmountBN.toFixed()} ${
              fromToken?.symbol ?? 'unknown'
            }`,
            alertLevel: ESwapAlertLevel.ERROR,
            inputShowError: true,
          },
        ];
      }
    }
    if (quoteResult && quoteResult.limit?.max) {
      const maxAmountBN = new BigNumber(quoteResult.limit.max);
      if (fromTokenAmountBN.gt(maxAmountBN)) {
        alerts = [
          ...alerts,
          {
            message: `The maximum amount for this swap is ${maxAmountBN.toFixed()} ${
              fromToken?.symbol ?? 'unknown'
            }`,
            alertLevel: ESwapAlertLevel.ERROR,
            inputShowError: true,
          },
        ];
      }
    }
    if (
      fromToken?.isNative &&
      fromTokenAmountBN.isEqualTo(
        new BigNumber(swapSelectFromTokenBalance ?? 0),
      )
    ) {
      alerts = [
        ...alerts,
        {
          message: `${fromToken.symbol} is required for the network fee, and the cost will be automatically deducted from amount in the next step.`,
          alertLevel: ESwapAlertLevel.INFO,
        },
      ];
    }
    return alerts;
  }, [
    fromToken,
    fromTokenAmount,
    quoteResult,
    swapFromAddressInfo.accountInfo,
    swapFromAddressInfo.address,
    swapFromAddressInfo.networkId,
    swapSelectFromTokenBalance,
    swapToAddressInfo.accountInfo?.accountName,
    swapToAddressInfo.accountInfo?.network?.name,
    swapToAddressInfo.accountInfo?.wallet?.name,
    swapToAddressInfo.accountInfo?.wallet?.type,
    swapToAddressInfo.address,
    swapToAddressInfo.networkId,
    toToken,
  ]);
  return {
    checkSwapWarning,
  };
}

export function useSwapActionState() {
  const [quoteFetching] = useSwapQuoteFetchingAtom();
  const [quoteCurrentSelect] = useSwapQuoteCurrentSelectAtom();
  const [buildTxFetching] = useSwapBuildTxFetchingAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [swapQuoteApproveAllowanceUnLimit] =
    useSwapQuoteApproveAllowanceUnLimitAtom();
  const { checkSwapWarning } = useSwapWarningCheck();

  const [selectedFromTokenBalance] = useSwapSelectedFromTokenBalanceAtom();
  const isCrossChain = fromToken?.networkId !== toToken?.networkId;
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const alerts = checkSwapWarning();
  const hasError = alerts.some(
    (item) => item.alertLevel === ESwapAlertLevel.ERROR,
  );
  const actionInfo = useMemo(() => {
    const infoRes = {
      disable: !(!hasError && !!quoteCurrentSelect),
      label: 'Swap',
    };
    if (quoteFetching) {
      infoRes.label = 'Fetching quotes';
    } else {
      if (isCrossChain && fromToken && toToken) {
        infoRes.label = 'Cross-Chain Swap';
      }
      if (quoteCurrentSelect && quoteCurrentSelect.isWrapped) {
        infoRes.label = 'Wrapped';
      }
      if (quoteCurrentSelect && quoteCurrentSelect.allowanceResult) {
        infoRes.label = swapQuoteApproveAllowanceUnLimit
          ? `Approve Unlimited ${fromToken?.symbol ?? ''} to ${
              quoteCurrentSelect?.info.providerName ?? ''
            }`
          : `Approve  ${fromTokenAmount} ${fromToken?.symbol ?? ''} to ${
              quoteCurrentSelect?.info.providerName ?? ''
            }`;
      }
      const fromTokenAmountBN = new BigNumber(fromTokenAmount);
      const balanceBN = new BigNumber(selectedFromTokenBalance ?? 0);
      if (
        fromToken &&
        swapFromAddressInfo.address &&
        balanceBN.lt(fromTokenAmountBN)
      ) {
        infoRes.label = 'Insufficient balance';
        infoRes.disable = true;
      }
    }
    return infoRes;
  }, [
    fromToken,
    fromTokenAmount,
    hasError,
    isCrossChain,
    quoteCurrentSelect,
    quoteFetching,
    selectedFromTokenBalance,
    swapFromAddressInfo.address,
    swapQuoteApproveAllowanceUnLimit,
    toToken,
  ]);

  const stepState: ISwapState = {
    label: actionInfo.label,
    isLoading: quoteFetching || buildTxFetching,
    disabled: actionInfo.disable,
    approveUnLimit: swapQuoteApproveAllowanceUnLimit,
    isApprove: !!quoteCurrentSelect?.allowanceResult,
    isCrossChain,
    shoutResetApprove:
      !!quoteCurrentSelect?.allowanceResult?.shouldResetApprove,
    alerts,
    isWrapped: !!quoteCurrentSelect?.isWrapped,
  };
  return stepState;
}
