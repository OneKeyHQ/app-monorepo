import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { debounce } from 'lodash';

import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  swapRateDifferenceMax,
  swapRateDifferenceMin,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  IFetchQuoteResult,
  ISwapAlertState,
  ISwapNetwork,
  ISwapState,
  ISwapToken,
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
  useSwapSilenceQuoteLoading,
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

  const refContainer = useRef<{
    fromToken?: ISwapToken;
    fromTokenAmount: string;
    networks: ISwapNetwork[];
    quoteResult?: IFetchQuoteResult;
    swapFromAddressInfo: ReturnType<typeof useSwapAddressInfo>;
    swapSelectFromTokenBalance: string | undefined;
    swapToAddressInfo: ReturnType<typeof useSwapAddressInfo>;
    toToken?: ISwapToken;
  }>({
    fromToken: undefined,
    fromTokenAmount: '',
    networks: [],
    quoteResult: undefined,
    swapFromAddressInfo: {
      address: undefined,
      networkId: undefined,
      accountInfo: undefined,
    },
    swapSelectFromTokenBalance: undefined,
    swapToAddressInfo: {
      address: undefined,
      networkId: undefined,
      accountInfo: undefined,
    },
    toToken: undefined,
  });

  const asyncRefContainer = useCallback(() => {
    if (refContainer.current.fromToken !== fromToken) {
      refContainer.current.fromToken = fromToken;
    }
    if (refContainer.current.fromTokenAmount !== fromTokenAmount) {
      refContainer.current.fromTokenAmount = fromTokenAmount;
    }
    if (refContainer.current.networks !== networks) {
      refContainer.current.networks = networks;
    }
    if (refContainer.current.quoteResult !== quoteResult) {
      refContainer.current.quoteResult = quoteResult;
    }
    if (refContainer.current.swapFromAddressInfo !== swapFromAddressInfo) {
      refContainer.current.swapFromAddressInfo = swapFromAddressInfo;
    }
    if (refContainer.current.swapToAddressInfo !== swapToAddressInfo) {
      refContainer.current.swapToAddressInfo = swapToAddressInfo;
    }
    if (
      refContainer.current.swapSelectFromTokenBalance !==
      swapSelectFromTokenBalance
    ) {
      refContainer.current.swapSelectFromTokenBalance =
        swapSelectFromTokenBalance;
    }
    if (refContainer.current.toToken !== toToken) {
      refContainer.current.toToken = toToken;
    }
  }, [
    fromToken,
    fromTokenAmount,
    networks,
    quoteResult,
    swapFromAddressInfo,
    swapSelectFromTokenBalance,
    swapToAddressInfo,
    toToken,
  ]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const checkSwapWarning = useCallback(
    debounce(() => {
      let alertsRes: ISwapAlertState[] = [];
      let rateDifferenceRes:
        | { value: string; unit: ESwapRateDifferenceUnit }
        | undefined;
      if (
        !refContainer.current.networks.length ||
        !refContainer.current.swapFromAddressInfo.accountInfo?.ready
      )
        return;
      // check account
      if (!refContainer.current.swapFromAddressInfo.accountInfo?.wallet) {
        alertsRes = [
          ...alertsRes,
          {
            message: 'No connected wallet.',
            alertLevel: ESwapAlertLevel.ERROR,
          },
        ];
      }

      if (
        refContainer.current.fromToken &&
        ((!refContainer.current.swapFromAddressInfo.address &&
          !accountUtils.isHdWallet({
            walletId:
              refContainer.current.swapFromAddressInfo.accountInfo?.wallet?.id,
          }) &&
          !accountUtils.isHwWallet({
            walletId:
              refContainer.current.swapFromAddressInfo.accountInfo?.wallet?.id,
          })) ||
          refContainer.current.swapFromAddressInfo.networkId !==
            refContainer.current.fromToken.networkId)
      ) {
        alertsRes = [
          ...alertsRes,
          {
            message: `The connected wallet do not support ${
              refContainer.current.networks.find(
                (net) =>
                  net.networkId === refContainer.current.fromToken?.networkId,
              )?.name ?? 'unknown'
            }. Try switch to another one.`,
            alertLevel: ESwapAlertLevel.ERROR,
          },
        ];
      }

      if (
        refContainer.current.toToken &&
        ((!refContainer.current.swapToAddressInfo.address &&
          !accountUtils.isHdWallet({
            walletId:
              refContainer.current.swapToAddressInfo.accountInfo?.wallet?.id,
          }) &&
          !accountUtils.isHwWallet({
            walletId:
              refContainer.current.swapToAddressInfo.accountInfo?.wallet?.id,
          })) ||
          refContainer.current.swapToAddressInfo.networkId !==
            refContainer.current.toToken.networkId)
      ) {
        alertsRes = [
          ...alertsRes,
          {
            message: `The connected wallet do not support ${
              refContainer.current.networks.find(
                (net) =>
                  net.networkId === refContainer.current.toToken?.networkId,
              )?.name ?? 'unknown'
            }. Try switch to another one.`,
            alertLevel: ESwapAlertLevel.ERROR,
          },
        ];
      }

      if (
        refContainer.current.fromToken &&
        accountUtils.isWatchingWallet({
          walletId:
            refContainer.current.swapFromAddressInfo.accountInfo?.wallet?.id,
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
        refContainer.current.fromToken &&
        !refContainer.current.swapFromAddressInfo.address &&
        (accountUtils.isHdWallet({
          walletId:
            refContainer.current.swapFromAddressInfo.accountInfo?.wallet?.id,
        }) ||
          accountUtils.isHwWallet({
            walletId:
              refContainer.current.swapFromAddressInfo.accountInfo?.wallet?.id,
          }))
      ) {
        alertsRes = [
          ...alertsRes,
          {
            message: `${
              refContainer.current.swapFromAddressInfo.accountInfo?.wallet
                ?.name ?? 'unknown'
            } - ${
              refContainer.current.swapFromAddressInfo.accountInfo
                ?.accountName ?? 'unknown'
            } lacks ${
              refContainer.current.swapFromAddressInfo.accountInfo?.network
                ?.name ?? 'unknown'
            } address. Please try to create one.`,
            alertLevel: ESwapAlertLevel.ERROR,
          },
        ];
      }

      if (
        refContainer.current.toToken &&
        !refContainer.current.swapToAddressInfo.address &&
        (accountUtils.isHdWallet({
          walletId:
            refContainer.current.swapToAddressInfo.accountInfo?.wallet?.id,
        }) ||
          accountUtils.isHwWallet({
            walletId:
              refContainer.current.swapToAddressInfo.accountInfo?.wallet?.id,
          })) &&
        refContainer.current.swapFromAddressInfo.networkId !==
          refContainer.current.swapToAddressInfo.networkId
      ) {
        alertsRes = [
          ...alertsRes,
          {
            message: `${
              refContainer.current.swapToAddressInfo.accountInfo?.wallet
                ?.name ?? 'unknown'
            } - ${
              refContainer.current.swapToAddressInfo.accountInfo?.accountName ??
              'unknown'
            } lacks ${
              refContainer.current.swapToAddressInfo.accountInfo?.network
                ?.name ?? 'unknown'
            } address. Please try to create one.`,
            alertLevel: ESwapAlertLevel.ERROR,
          },
        ];
      }

      // provider toAmount check
      if (
        refContainer.current.quoteResult &&
        !refContainer.current.quoteResult?.toAmount &&
        !refContainer.current.quoteResult?.limit
      ) {
        alertsRes = [
          ...alertsRes,
          {
            message: 'No provider supports this trade.',
            alertLevel: ESwapAlertLevel.ERROR,
          },
        ];
      }

      // provider best check
      if (
        refContainer.current.quoteResult?.toAmount &&
        !refContainer.current.quoteResult.isBest
      ) {
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
      if (
        (refContainer.current.fromToken &&
          !refContainer.current.fromToken?.price) ||
        (refContainer.current.toToken && !refContainer.current.toToken?.price)
      ) {
        alertsRes = [
          ...alertsRes,
          {
            message: `Failed to fetch ${
              !refContainer.current.fromToken?.price
                ? refContainer.current.fromToken?.name ??
                  refContainer.current.fromToken?.symbol ??
                  'unknown'
                : refContainer.current.toToken?.name ??
                  refContainer.current.toToken?.symbol ??
                  'unknown'
            } price.You can still proceed with the trade.`,
            alertLevel: ESwapAlertLevel.WARNING,
          },
        ];
      }

      // market rate check
      if (
        refContainer.current.fromToken?.price &&
        refContainer.current.toToken?.price &&
        refContainer.current.quoteResult?.instantRate
      ) {
        const fromTokenPrice = new BigNumber(
          refContainer.current.fromToken.price,
        );
        const toTokenPrice = new BigNumber(refContainer.current.toToken.price);
        const marketingRate = fromTokenPrice.dividedBy(toTokenPrice);
        const quoteRateBN = new BigNumber(
          refContainer.current.quoteResult.instantRate,
        );
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

      const fromTokenAmountBN = new BigNumber(
        refContainer.current.fromTokenAmount,
      );
      // check min max amount
      if (
        refContainer.current.quoteResult &&
        refContainer.current.quoteResult.limit?.min
      ) {
        const minAmountBN = new BigNumber(
          refContainer.current.quoteResult.limit.min,
        );
        if (fromTokenAmountBN.lt(minAmountBN)) {
          alertsRes = [
            ...alertsRes,
            {
              message: `The minimum amount for this swap is ${minAmountBN.toFixed()} ${
                refContainer.current.fromToken?.symbol ?? 'unknown'
              }`,
              alertLevel: ESwapAlertLevel.ERROR,
              inputShowError: true,
            },
          ];
        }
      }
      if (
        refContainer.current.quoteResult &&
        refContainer.current.quoteResult.limit?.max
      ) {
        const maxAmountBN = new BigNumber(
          refContainer.current.quoteResult.limit.max,
        );
        if (fromTokenAmountBN.gt(maxAmountBN)) {
          alertsRes = [
            ...alertsRes,
            {
              message: `The maximum amount for this swap is ${maxAmountBN.toFixed()} ${
                refContainer.current.fromToken?.symbol ?? 'unknown'
              }`,
              alertLevel: ESwapAlertLevel.ERROR,
              inputShowError: true,
            },
          ];
        }
      }

      const fromTokenPriceBN = new BigNumber(
        refContainer.current.fromToken?.price ?? 0,
      );
      const tokenFiatValueBN = fromTokenAmountBN.multipliedBy(fromTokenPriceBN);

      const gasFeeBN = new BigNumber(
        refContainer.current.quoteResult?.fee?.estimatedFeeFiatValue ?? 0,
      );
      if (
        !(tokenFiatValueBN.isNaN() || tokenFiatValueBN.isZero()) &&
        gasFeeBN.gt(tokenFiatValueBN)
      ) {
        alertsRes = [
          ...alertsRes,
          {
            message:
              'Est Network fee exceeds swap amount, proceed with caution.',
            alertLevel: ESwapAlertLevel.WARNING,
          },
        ];
      }

      if (
        refContainer.current.fromToken?.isNative &&
        fromTokenAmountBN.isEqualTo(
          new BigNumber(refContainer.current.swapSelectFromTokenBalance ?? 0),
        )
      ) {
        alertsRes = [
          ...alertsRes,
          {
            message: `Network fee in ${refContainer.current.fromToken.symbol} deducted automatically in the next step.`,
            alertLevel: ESwapAlertLevel.INFO,
          },
        ];
      }
      setAlerts(alertsRes);
      setRateDifference(rateDifferenceRes);
    }, 300),
    [],
  );

  useEffect(() => {
    asyncRefContainer();
    checkSwapWarning();
  }, [asyncRefContainer, checkSwapWarning]);
  return { alerts, rateDifference };
}

export function useSwapActionState() {
  const [quoteFetching] = useSwapQuoteFetchingAtom();
  const [silenceQuoteLoading] = useSwapSilenceQuoteLoading();
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
    if (quoteFetching || silenceQuoteLoading) {
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
    silenceQuoteLoading,
    selectedFromTokenBalance,
    swapFromAddressInfo.address,
    swapQuoteApproveAllowanceUnLimit,
    toToken,
  ]);

  const stepState: ISwapState = {
    label: actionInfo.label,
    rateDifference,
    isLoading: quoteFetching || buildTxFetching || silenceQuoteLoading,
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
