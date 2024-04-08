import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  swapRateDifferenceMax,
  swapRateDifferenceMin,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  ISwapAlertState,
  ISwapState,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapAlertLevel,
  ESwapDirectionType,
  ESwapRateDifferenceUnit,
} from '@onekeyhq/shared/types/swap/types';

import {
  useSwapBuildTxFetchingAtom,
  useSwapFromTokenAmountAtom,
  useSwapNetworksAtom,
  useSwapQuoteApproveAllowanceUnLimitAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapQuoteFetchingAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectedFromTokenBalanceAtom,
} from '../../../states/jotai/contexts/swap';

import { useSwapAddressInfo } from './useSwapAccount';

function useSwapWarningCheck() {
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [networks] = useSwapNetworksAtom();
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const swapToAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [quoteResult] = useSwapQuoteCurrentSelectAtom();
  const [swapSelectFromTokenBalance] = useSwapSelectedFromTokenBalanceAtom();
  const [alerts, setAlerts] = useState<ISwapAlertState[]>([]);
  const [rateDifference, setRateDifference] = useState<
    { value: string; unit: ESwapRateDifferenceUnit } | undefined
  >();
  const checkSwapWarning = useCallback(() => {
    let alertsRes: ISwapAlertState[] = [];
    let rateDifferenceRes:
      | { value: string; unit: ESwapRateDifferenceUnit }
      | undefined;
    if (!networks.length || !swapFromAddressInfo.accountInfo?.ready) return;
    // check account
    if (!swapFromAddressInfo.accountInfo?.wallet) {
      alertsRes = [
        ...alertsRes,
        {
          message: 'No connected wallet.',
          alertLevel: ESwapAlertLevel.ERROR,
        },
      ];
    }

    if (
      fromToken &&
      ((!swapFromAddressInfo.address &&
        !accountUtils.isHdWallet({
          walletId: swapFromAddressInfo.accountInfo?.wallet?.id,
        }) &&
        !accountUtils.isHwWallet({
          walletId: swapFromAddressInfo.accountInfo?.wallet?.id,
        })) ||
        swapFromAddressInfo.networkId !== fromToken.networkId)
    ) {
      alertsRes = [
        ...alertsRes,
        {
          message: `The connected wallet do not support ${
            networks.find((net) => net.networkId === fromToken.networkId)
              ?.name ?? 'unknown'
          }. Try switch to another one.`,
          alertLevel: ESwapAlertLevel.ERROR,
        },
      ];
    }

    if (
      toToken &&
      ((!swapToAddressInfo.address &&
        !accountUtils.isHdWallet({
          walletId: swapToAddressInfo.accountInfo?.wallet?.id,
        }) &&
        !accountUtils.isHwWallet({
          walletId: swapToAddressInfo.accountInfo?.wallet?.id,
        })) ||
        swapToAddressInfo.networkId !== toToken.networkId)
    ) {
      alertsRes = [
        ...alertsRes,
        {
          message: `The connected wallet do not support ${
            networks.find((net) => net.networkId === toToken.networkId)?.name ??
            'unknown'
          }. Try switch to another one.`,
          alertLevel: ESwapAlertLevel.ERROR,
        },
      ];
    }

    if (
      fromToken &&
      accountUtils.isWatchingWallet({
        walletId: swapFromAddressInfo.accountInfo?.wallet?.id,
      })
    ) {
      alertsRes = [
        ...alertsRes,
        {
          message: `The connected wallet do not support swap. Try switch to another one.`,
          alertLevel: ESwapAlertLevel.ERROR,
        },
      ];
    }

    if (
      fromToken &&
      !swapFromAddressInfo.address &&
      (accountUtils.isHdWallet({
        walletId: swapFromAddressInfo.accountInfo?.wallet?.id,
      }) ||
        accountUtils.isHwWallet({
          walletId: swapFromAddressInfo.accountInfo?.wallet?.id,
        }))
    ) {
      alertsRes = [
        ...alertsRes,
        {
          message: `${
            swapFromAddressInfo.accountInfo?.wallet?.name ?? 'unknown'
          } - ${
            swapFromAddressInfo.accountInfo?.accountName ?? 'unknown'
          } lacks ${
            swapFromAddressInfo.accountInfo?.network?.name ?? 'unknown'
          } address. Please try to create one.`,
          alertLevel: ESwapAlertLevel.ERROR,
        },
      ];
    }

    if (
      toToken &&
      !swapToAddressInfo.address &&
      (accountUtils.isHdWallet({
        walletId: swapToAddressInfo.accountInfo?.wallet?.id,
      }) ||
        accountUtils.isHwWallet({
          walletId: swapToAddressInfo.accountInfo?.wallet?.id,
        })) &&
      swapFromAddressInfo.networkId !== swapToAddressInfo.networkId
    ) {
      alertsRes = [
        ...alertsRes,
        {
          message: `${
            swapToAddressInfo.accountInfo?.wallet?.name ?? 'unknown'
          } - ${
            swapToAddressInfo.accountInfo?.accountName ?? 'unknown'
          } lacks ${
            swapToAddressInfo.accountInfo?.network?.name ?? 'unknown'
          } address. Please try to create one.`,
          alertLevel: ESwapAlertLevel.ERROR,
        },
      ];
    }

    // provider toAmount check
    if (quoteResult && !quoteResult?.toAmount && !quoteResult?.limit) {
      alertsRes = [
        ...alertsRes,
        {
          message: 'No provider supports this trade.',
          alertLevel: ESwapAlertLevel.ERROR,
        },
      ];
    }

    // provider best check
    if (quoteResult?.toAmount && !quoteResult.isBest) {
      alertsRes = [
        ...alertsRes,
        {
          message:
            'The current provider does not offer the best rate for this trade.',
          alertLevel: ESwapAlertLevel.WARNING,
        },
      ];
    }

    // price check
    if ((fromToken && !fromToken?.price) || (toToken && !toToken?.price)) {
      alertsRes = [
        ...alertsRes,
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
    if (fromToken?.price && toToken?.price && quoteResult?.instantRate) {
      const fromTokenPrice = new BigNumber(fromToken.price);
      const toTokenPrice = new BigNumber(toToken.price);
      const marketingRate = fromTokenPrice.dividedBy(toTokenPrice);
      const quoteRateBN = new BigNumber(quoteResult.instantRate);
      const difference = quoteRateBN
        .dividedBy(marketingRate)
        .minus(1)
        .multipliedBy(100);
      if (difference.absoluteValue().gte(swapRateDifferenceMin)) {
        let unit = ESwapRateDifferenceUnit.POSITIVE;
        if (difference.isNegative()) {
          if (difference.lte(swapRateDifferenceMax)) {
            unit = ESwapRateDifferenceUnit.NEGATIVE;
          } else {
            unit = ESwapRateDifferenceUnit.DEFAULT;
          }
        }
        rateDifferenceRes = {
          value: `(${difference.isPositive() ? '+' : ''}${
            numberFormat(difference.toFixed(), {
              formatter: 'priceChange',
            }) as string
          })`,
          unit,
        };
      }
      if (quoteRateBN.isZero()) {
        alertsRes = [
          ...alertsRes,
          {
            message: `100% value drop! High price impact may cause your asset loss.`,
            alertLevel: ESwapAlertLevel.WARNING,
          },
        ];
      } else if (difference.lt(swapRateDifferenceMax)) {
        alertsRes = [
          ...alertsRes,
          {
            message: `${
              numberFormat(difference.absoluteValue().toFixed(), {
                formatter: 'priceChange',
              }) as string
            } value drop! High price impact may cause your asset loss.`,
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
        alertsRes = [
          ...alertsRes,
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
        alertsRes = [
          ...alertsRes,
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

    const fromTokenPriceBN = new BigNumber(fromToken?.price ?? 0);
    const tokenFiatValueBN = fromTokenAmountBN.multipliedBy(fromTokenPriceBN);

    const gasFeeBN = new BigNumber(
      quoteResult?.fee?.estimatedFeeFiatValue ?? 0,
    );
    if (
      !(tokenFiatValueBN.isNaN() || tokenFiatValueBN.isZero()) &&
      gasFeeBN.gt(tokenFiatValueBN)
    ) {
      alertsRes = [
        ...alertsRes,
        {
          message: 'Est Network fee exceeds swap amount, proceed with caution.',
          alertLevel: ESwapAlertLevel.WARNING,
        },
      ];
    }

    if (
      fromToken?.isNative &&
      fromTokenAmountBN.isEqualTo(
        new BigNumber(swapSelectFromTokenBalance ?? 0),
      )
    ) {
      alertsRes = [
        ...alertsRes,
        {
          message: `Network fee in ${fromToken.symbol} deducted automatically in the next step.`,
          alertLevel: ESwapAlertLevel.INFO,
        },
      ];
    }
    setAlerts(alertsRes);
    setRateDifference(rateDifferenceRes);
  }, [
    fromToken,
    fromTokenAmount,
    networks,
    quoteResult,
    swapFromAddressInfo.accountInfo?.accountName,
    swapFromAddressInfo.accountInfo?.network?.name,
    swapFromAddressInfo.accountInfo?.ready,
    swapFromAddressInfo.accountInfo?.wallet,
    swapFromAddressInfo.address,
    swapFromAddressInfo.networkId,
    swapSelectFromTokenBalance,
    swapToAddressInfo.accountInfo?.accountName,
    swapToAddressInfo.accountInfo?.network?.name,
    swapToAddressInfo.accountInfo?.wallet?.id,
    swapToAddressInfo.accountInfo?.wallet?.name,
    swapToAddressInfo.address,
    swapToAddressInfo.networkId,
    toToken,
  ]);

  useEffect(() => {
    checkSwapWarning();
  }, [checkSwapWarning]);
  return { alerts, rateDifference };
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
  const { alerts, rateDifference } = useSwapWarningCheck();

  const [selectedFromTokenBalance] = useSwapSelectedFromTokenBalanceAtom();
  const isCrossChain = fromToken?.networkId !== toToken?.networkId;
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
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
    rateDifference,
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
