import { useCallback } from 'react';

import {
  OrderBalance,
  hashify,
  normalizeBuyTokenBalance,
  timestamp,
} from '@cowprotocol/contracts';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { cloneDeep } from 'lodash';
import { useIntl } from 'react-intl';

import { EPageType, Toast, usePageType } from '@onekeyhq/components';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import {
  useInAppNotificationAtom,
  useSettingsAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IApproveInfo,
  ITransferInfo,
  IWrappedInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  numberFormat,
  toBigIntHex,
} from '@onekeyhq/shared/src/utils/numberUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  EMessageTypesEth,
  ESigningScheme,
} from '@onekeyhq/shared/types/message';
import { swapApproveResetValue } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  IFetchLimitOrderRes,
  IFetchQuoteResult,
  IOneInchOrderStruct,
  ISwapToken,
  ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapApproveTransactionStatus,
  ESwapDirectionType,
  ESwapQuoteKind,
  EWrappedType,
} from '@onekeyhq/shared/types/swap/types';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useSignatureConfirm } from '../../../hooks/useSignatureConfirm';
import {
  useSwapBuildTxFetchingAtom,
  useSwapFromTokenAmountAtom,
  useSwapLimitExpirationTimeAtom,
  useSwapLimitPartiallyFillAtom,
  useSwapLimitPriceFromAmountAtom,
  useSwapLimitPriceToAmountAtom,
  useSwapLimitPriceUseRateAtom,
  useSwapManualSelectQuoteProvidersAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapQuoteEventTotalCountAtom,
  useSwapQuoteListAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapShouldRefreshQuoteAtom,
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';

import { useSwapAddressInfo } from './useSwapAccount';
import {
  useSwapBatchTransfer,
  useSwapSlippagePercentageModeInfo,
} from './useSwapState';
import { useSwapTxHistoryActions } from './useSwapTxHistory';

export function useSwapBuildTx() {
  const intl = useIntl();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const { slippageItem } = useSwapSlippagePercentageModeInfo();
  const [selectQuote] = useSwapQuoteCurrentSelectAtom();
  const [, setSwapQuoteResultList] = useSwapQuoteListAtom();
  const [, setSwapQuoteEventTotalCount] = useSwapQuoteEventTotalCountAtom();
  const [, setSwapBuildTxFetching] = useSwapBuildTxFetchingAtom();
  const [inAppNotificationAtom, setInAppNotificationAtom] =
    useInAppNotificationAtom();
  const [, setSwapFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [, setSwapToTokenAmount] = useSwapToTokenAmountAtom();
  const [, setSwapShouldRefreshQuote] = useSwapShouldRefreshQuoteAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const swapToAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  const [, setSwapManualSelectQuoteProviders] =
    useSwapManualSelectQuoteProvidersAtom();
  const { generateSwapHistoryItem } = useSwapTxHistoryActions();
  const [swapLimitExpirationTime] = useSwapLimitExpirationTimeAtom();
  const [swapLimitPriceFromAmount] = useSwapLimitPriceFromAmountAtom();
  const [swapLimitPriceToAmount] = useSwapLimitPriceToAmountAtom();
  const [swapLimitPartiallyFillObj] = useSwapLimitPartiallyFillAtom();
  const [swapUseInstantRate] = useSwapLimitPriceUseRateAtom();
  const [{ isFirstTimeSwap }, setPersistSettings] = useSettingsPersistAtom();
  const [, setSettings] = useSettingsAtom();
  const { navigationToTxConfirm, navigationToMessageConfirm } =
    useSignatureConfirm({
      accountId: swapFromAddressInfo.accountInfo?.account?.id ?? '',
      networkId: swapFromAddressInfo.networkId ?? '',
    });

  const pageType = usePageType();

  const isBatchTransfer = useSwapBatchTransfer(
    swapFromAddressInfo.networkId,
    swapFromAddressInfo.accountInfo?.account?.id,
    selectQuote?.providerDisableBatchTransfer,
  );

  const syncRecentTokenPairs = useCallback(
    async ({
      swapFromToken,
      swapToToken,
    }: {
      swapFromToken: ISwapToken;
      swapToToken: ISwapToken;
    }) => {
      await backgroundApiProxy.serviceSwap.swapRecentTokenPairsUpdate({
        fromToken: swapFromToken,
        toToken: swapToToken,
      });
    },
    [],
  );

  const clearQuoteData = useCallback(() => {
    setSwapFromTokenAmount({
      value: '',
      isInput: false,
    }); // send success, clear from token amount
    setSwapToTokenAmount({
      value: '',
      isInput: false,
    }); // send success, clear to token amount
    setSwapQuoteResultList([]);
    setSwapQuoteEventTotalCount({
      count: 0,
    });
    setSettings((v) => ({
      // reset account switch for reset swap receive address
      ...v,
      swapToAnotherAccountSwitchOn: false,
    }));
  }, [
    setSettings,
    setSwapFromTokenAmount,
    setSwapQuoteEventTotalCount,
    setSwapQuoteResultList,
    setSwapToTokenAmount,
  ]);

  const handleBuildTxSuccess = useCallback(
    async (data: ISendTxOnSuccessData[]) => {
      if (data?.[0]) {
        clearQuoteData();
        const transactionSignedInfo = data[0].signedTx;
        const transactionDecodedInfo = data[0].decodedTx;
        const txId = transactionSignedInfo.txid;
        const { swapInfo } = transactionSignedInfo;
        const { totalFeeInNative, totalFeeFiatValue, networkId } =
          transactionDecodedInfo;
        if (swapInfo) {
          await generateSwapHistoryItem({
            txId,
            gasFeeFiatValue: totalFeeFiatValue,
            gasFeeInNative: totalFeeInNative,
            swapTxInfo: swapInfo,
          });
          if (
            swapInfo.sender.token.networkId ===
            swapInfo.receiver.token.networkId
          ) {
            void backgroundApiProxy.serviceNotification.blockNotificationForTxId(
              {
                networkId,
                tx: txId,
              },
            );
          }
        }
      }
      setSwapBuildTxFetching(false);
    },
    [setSwapBuildTxFetching, clearQuoteData, generateSwapHistoryItem],
  );

  const handleBuildTxSuccessWithSignedNoSend = useCallback(
    async ({ swapInfo }: { swapInfo: ISwapTxInfo }) => {
      clearQuoteData();
      if (swapInfo) {
        await generateSwapHistoryItem({
          swapTxInfo: swapInfo,
        });
      }
    },
    [clearQuoteData, generateSwapHistoryItem],
  );

  const handleApproveTxSuccess = useCallback(
    async (data: ISendTxOnSuccessData[]) => {
      if (data?.[0]) {
        const transactionSignedInfo = data[0].signedTx;
        const txId = transactionSignedInfo.txid;
        if (
          inAppNotificationAtom.swapApprovingTransaction &&
          !inAppNotificationAtom.swapApprovingTransaction.resetApproveValue
        ) {
          void backgroundApiProxy.serviceNotification.blockNotificationForTxId({
            networkId:
              inAppNotificationAtom.swapApprovingTransaction.fromToken
                .networkId,
            tx: txId,
          });
        }
        if (data[0].approveInfo?.swapApproveRes) {
          setSwapManualSelectQuoteProviders(
            data[0].approveInfo?.swapApproveRes,
          );
        }
        setInAppNotificationAtom((prev) => {
          if (prev.swapApprovingTransaction) {
            return {
              ...prev,
              swapApprovingTransaction: {
                ...prev.swapApprovingTransaction,
                txId,
              },
            };
          }
          return prev;
        });
      }
    },
    [
      inAppNotificationAtom.swapApprovingTransaction,
      setInAppNotificationAtom,
      setSwapManualSelectQuoteProviders,
    ],
  );

  const handleTxFail = useCallback(() => {
    setSwapBuildTxFetching(false);
  }, [setSwapBuildTxFetching]);

  const cancelBuildTx = useCallback(() => {
    handleTxFail();
    setSwapShouldRefreshQuote(true);
  }, [handleTxFail, setSwapShouldRefreshQuote]);

  const cancelApproveTx = useCallback(() => {
    handleTxFail();
    setInAppNotificationAtom((prev) => {
      if (prev.swapApprovingTransaction) {
        return {
          ...prev,
          swapApprovingTransaction: {
            ...prev.swapApprovingTransaction,
            status: ESwapApproveTransactionStatus.CANCEL,
          },
        };
      }
      return prev;
    });
  }, [handleTxFail, setInAppNotificationAtom]);

  const checkOtherFee = useCallback(
    async (quoteResult: IFetchQuoteResult) => {
      const otherFeeInfo = quoteResult?.fee?.otherFeeInfos;
      let checkRes = true;
      if (otherFeeInfo?.length) {
        await Promise.all(
          otherFeeInfo.map(async (item) => {
            const tokenBalanceInfo =
              await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
                networkId: item.token?.networkId,
                contractAddress: item.token?.contractAddress,
                accountAddress: swapFromAddressInfo.address,
                accountId: swapFromAddressInfo.accountInfo?.account?.id,
              });
            if (tokenBalanceInfo?.length) {
              const tokenBalanceBN = new BigNumber(
                tokenBalanceInfo[0].balanceParsed ?? 0,
              );
              const shouldAddFromAmount = equalTokenNoCaseSensitive({
                token1: item.token,
                token2: fromToken,
              });

              const tokenAmountBN = new BigNumber(item.amount ?? 0);
              const fromTokenAmountBN = new BigNumber(
                selectQuote?.fromAmount ?? 0,
              );
              const finalTokenAmount = shouldAddFromAmount
                ? tokenAmountBN.plus(fromTokenAmountBN).toFixed()
                : tokenAmountBN.toFixed();
              if (tokenBalanceBN.lt(finalTokenAmount)) {
                Toast.error({
                  title: intl.formatMessage(
                    {
                      id: ETranslations.swap_page_toast_insufficient_balance_title,
                    },
                    { token: item.token.symbol },
                  ),
                  message: intl.formatMessage(
                    {
                      id: ETranslations.swap_page_toast_insufficient_balance_content,
                    },
                    {
                      token: item.token.symbol,
                      number: numberFormat(tokenAmountBN.toFixed(), {
                        formatter: 'balance',
                      }) as string,
                    },
                  ),
                });
                checkRes = false;
              }
            }
          }),
        );
      }
      return checkRes;
    },
    [
      fromToken,
      intl,
      selectQuote?.fromAmount,
      swapFromAddressInfo.accountInfo?.account?.id,
      swapFromAddressInfo.address,
    ],
  );

  const wrappedTx = useCallback(async () => {
    if (
      fromToken &&
      toToken &&
      selectQuote?.fromAmount &&
      selectQuote?.toAmount &&
      swapFromAddressInfo.address &&
      swapToAddressInfo.address &&
      swapFromAddressInfo.networkId
    ) {
      setSwapBuildTxFetching(true);
      const wrappedType = fromToken.isNative
        ? EWrappedType.DEPOSIT
        : EWrappedType.WITHDRAW;
      const wrappedInfo: IWrappedInfo = {
        from: swapFromAddressInfo.address,
        type: wrappedType,
        contract:
          wrappedType === EWrappedType.WITHDRAW
            ? fromToken.contractAddress
            : toToken.contractAddress,
        amount: selectQuote?.fromAmount,
      };
      const swapInfo = {
        protocol: selectQuote?.protocol ?? EProtocolOfExchange.SWAP,
        sender: {
          amount: selectQuote?.fromAmount,
          token: fromToken,
          accountInfo: {
            accountId: swapFromAddressInfo.accountInfo?.account?.id,
            networkId: fromToken.networkId,
          },
        },
        receiver: {
          amount: selectQuote.toAmount,
          token: toToken,
          accountInfo: {
            accountId: swapToAddressInfo.accountInfo?.account?.id,
            networkId: toToken.networkId,
          },
        },
        accountAddress: swapFromAddressInfo.address,
        receivingAddress: swapToAddressInfo.address,
        swapBuildResData: { result: selectQuote },
      };
      await navigationToTxConfirm({
        wrappedInfo,
        swapInfo,
        isInternalSwap: true,
        onSuccess: handleBuildTxSuccess,
        onCancel: handleTxFail,
      });
      void syncRecentTokenPairs({
        swapFromToken: fromToken,
        swapToToken: toToken,
      });
    }
  }, [
    fromToken,
    toToken,
    selectQuote,
    swapFromAddressInfo.address,
    swapFromAddressInfo.networkId,
    swapFromAddressInfo.accountInfo?.account?.id,
    swapToAddressInfo.address,
    swapToAddressInfo.accountInfo?.account?.id,
    setSwapBuildTxFetching,
    navigationToTxConfirm,
    handleBuildTxSuccess,
    handleTxFail,
    syncRecentTokenPairs,
  ]);

  const createBuildTx = useCallback(async () => {
    const selectQuoteRes = cloneDeep(selectQuote);
    if (
      fromToken &&
      toToken &&
      selectQuoteRes?.fromAmount &&
      slippageItem &&
      selectQuoteRes?.toAmount &&
      swapFromAddressInfo.address &&
      swapToAddressInfo.address &&
      swapFromAddressInfo.networkId
    ) {
      try {
        if (
          selectQuoteRes.swapShouldSignedData &&
          swapFromAddressInfo.accountInfo?.account?.id
        ) {
          const {
            unSignedInfo,
            unSignedMessage,
            unSignedData,
            oneInchFusionOrder,
          } = selectQuoteRes.swapShouldSignedData;
          if (
            (unSignedMessage || unSignedData) &&
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            selectQuoteRes.quoteResultCtx?.cowSwapUnSignedOrder
          ) {
            const unSignedOrder: {
              sellTokenBalance: string;
              buyTokenBalance: string;
              validTo: number;
              appData: string;
              receiver: string;
              buyAmount: string;
              sellAmount: string;
              partiallyFillable: boolean;
            } =
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              selectQuoteRes.quoteResultCtx?.cowSwapUnSignedOrder;
            unSignedOrder.receiver = swapToAddressInfo.address;
            let dataMessage = unSignedMessage;
            if (!dataMessage && unSignedData) {
              let validTo = unSignedOrder.validTo;
              const swapLimitExpirationTimeValueBN = new BigNumber(
                swapLimitExpirationTime.value,
              );
              const now = Math.floor(Date.now() / 1000); // 获取当前秒级时间戳
              validTo = new BigNumber(now)
                .plus(swapLimitExpirationTimeValueBN)
                .decimalPlaces(0)
                .toNumber();
              let finalBuyAmount = unSignedOrder.buyAmount;
              let finalSellAmount = unSignedOrder.sellAmount;
              if (
                selectQuote?.protocol === EProtocolOfExchange.LIMIT &&
                (swapLimitPriceFromAmount || swapLimitPriceToAmount)
              ) {
                const decimals =
                  selectQuote?.kind === ESwapQuoteKind.SELL
                    ? toToken.decimals
                    : fromToken.decimals;
                const finalAmountBN = new BigNumber(
                  selectQuote?.kind === ESwapQuoteKind.SELL
                    ? swapLimitPriceToAmount
                    : swapLimitPriceFromAmount,
                ).shiftedBy(decimals);
                if (selectQuote?.kind === ESwapQuoteKind.SELL) {
                  finalBuyAmount = finalAmountBN.toFixed();
                } else {
                  finalSellAmount = finalAmountBN.toFixed();
                }
              }
              let partiallyFillable = unSignedOrder.partiallyFillable;
              if (swapLimitPartiallyFillObj.value !== partiallyFillable) {
                partiallyFillable = swapLimitPartiallyFillObj.value;
              }
              unSignedOrder.buyAmount = finalBuyAmount;
              unSignedOrder.sellAmount = finalSellAmount;
              unSignedOrder.validTo = validTo;
              unSignedOrder.partiallyFillable = partiallyFillable;
              const normalizeData = {
                ...unSignedOrder,
                sellTokenBalance:
                  (unSignedOrder.sellTokenBalance as OrderBalance) ??
                  OrderBalance.ERC20,
                buyTokenBalance: normalizeBuyTokenBalance(
                  unSignedOrder.buyTokenBalance as OrderBalance,
                ),
                validTo: timestamp(validTo),
                appData: hashify(unSignedOrder.appData),
              };
              const populated =
                await ethers.utils._TypedDataEncoder.resolveNames(
                  unSignedData.domain,
                  unSignedData.types,
                  normalizeData,
                  async (value: string) => value,
                );
              dataMessage = JSON.stringify(
                ethers.utils._TypedDataEncoder.getPayload(
                  populated.domain,
                  unSignedData.types,
                  populated.value,
                ),
              );
            }
            if (dataMessage) {
              const swapInfo: ISwapTxInfo = {
                protocol: selectQuoteRes.protocol ?? EProtocolOfExchange.SWAP,
                sender: {
                  amount: unSignedOrder.sellAmount,
                  token: fromToken,
                  accountInfo: {
                    accountId: swapFromAddressInfo.accountInfo?.account?.id,
                    networkId: fromToken.networkId,
                  },
                },
                receiver: {
                  amount: unSignedOrder.buyAmount,
                  token: toToken,
                  accountInfo: {
                    accountId: swapToAddressInfo.accountInfo?.account?.id,
                    networkId: toToken.networkId,
                  },
                },
                accountAddress: swapFromAddressInfo.address,
                receivingAddress: swapToAddressInfo.address,
                swapBuildResData: {
                  result: {
                    ...selectQuoteRes,
                    ...(selectQuoteRes.protocol !== EProtocolOfExchange.LIMIT
                      ? {
                          slippage:
                            selectQuoteRes.slippage ??
                            selectQuoteRes.autoSuggestedSlippage ??
                            slippageItem.value,
                        }
                      : {}),
                    ...(swapUseInstantRate.rate &&
                    selectQuoteRes.protocol === EProtocolOfExchange.LIMIT
                      ? {
                          instantRate: swapUseInstantRate.rate,
                        }
                      : {}),
                  },
                },
              };
              const signHash = await new Promise<string>((resolve, reject) => {
                if (
                  dataMessage &&
                  swapFromAddressInfo.address &&
                  swapFromAddressInfo.networkId
                ) {
                  navigationToMessageConfirm({
                    accountId:
                      swapFromAddressInfo.accountInfo?.account?.id ?? '',
                    networkId: swapFromAddressInfo.networkId,
                    swapInfo,
                    unsignedMessage: {
                      type:
                        unSignedInfo.signedType ??
                        EMessageTypesEth.TYPED_DATA_V4,
                      message: dataMessage,
                      payload: [
                        swapFromAddressInfo.address.toLowerCase(),
                        dataMessage,
                      ],
                    },
                    walletInternalSign: true,
                    onSuccess: (result: string) => {
                      resolve(result);
                    },
                    onFail: (error: Error) => {
                      reject(error);
                    },
                    onCancel: () => {
                      reject(new Error('user cancel'));
                    },
                  });
                } else {
                  reject(
                    new Error(
                      `missing data: dataMessage: ${
                        dataMessage ?? ''
                      }, address: ${
                        swapFromAddressInfo.address ?? ''
                      }, networkId: ${swapFromAddressInfo.networkId ?? ''}`,
                    ),
                  );
                }
              });
              if (signHash) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                selectQuoteRes.quoteResultCtx.cowSwapUnSignedOrder =
                  unSignedOrder;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                selectQuoteRes.quoteResultCtx.signedResult = {
                  signature: signHash,
                  signingScheme: ESigningScheme.EIP712,
                };
              }
            }
          } else if (oneInchFusionOrder) {
            const { makerAddress, typedData } = oneInchFusionOrder;
            const onInchFusionOrderInfo: {
              orderStruct: IOneInchOrderStruct;
              extension: string;
              quoteId: string;
              signature?: string;
              orderHash: string;
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            } = selectQuoteRes.quoteResultCtx?.oneInchFusionOrderCtx;
            if (makerAddress && typedData && onInchFusionOrderInfo) {
              const swapInfo: ISwapTxInfo = {
                protocol: selectQuoteRes.protocol ?? EProtocolOfExchange.SWAP,
                sender: {
                  amount: onInchFusionOrderInfo.orderStruct.makingAmount,
                  token: fromToken,
                  accountInfo: {
                    accountId: swapFromAddressInfo.accountInfo?.account?.id,
                    networkId: fromToken.networkId,
                  },
                },
                receiver: {
                  amount: onInchFusionOrderInfo.orderStruct.takingAmount,
                  token: toToken,
                  accountInfo: {
                    accountId: swapToAddressInfo.accountInfo?.account?.id,
                    networkId: toToken.networkId,
                  },
                },
                accountAddress: swapFromAddressInfo.address,
                receivingAddress: swapToAddressInfo.address,
                swapBuildResData: {
                  result: {
                    ...selectQuoteRes,
                  },
                },
              };
              const dataMessage = JSON.stringify(typedData);
              const signHash = await new Promise<string>((resolve, reject) => {
                if (
                  dataMessage &&
                  swapFromAddressInfo.address &&
                  swapFromAddressInfo.networkId
                ) {
                  navigationToMessageConfirm({
                    accountId:
                      swapFromAddressInfo.accountInfo?.account?.id ?? '',
                    networkId: swapFromAddressInfo.networkId,
                    swapInfo,
                    unsignedMessage: {
                      type:
                        unSignedInfo.signedType ??
                        EMessageTypesEth.TYPED_DATA_V4,
                      message: dataMessage,
                      payload: [makerAddress.toLowerCase(), dataMessage],
                    },
                    walletInternalSign: true,
                    onSuccess: (result: string) => {
                      resolve(result);
                    },
                    onFail: (error: Error) => {
                      reject(error);
                    },
                    onCancel: () => {
                      reject(new Error('user cancel'));
                    },
                  });
                } else {
                  reject(
                    new Error(
                      `missing data: dataMessage: ${
                        dataMessage ?? ''
                      }, address: ${
                        swapFromAddressInfo.address ?? ''
                      }, networkId: ${swapFromAddressInfo.networkId ?? ''}`,
                    ),
                  );
                }
              });
              if (signHash) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                selectQuoteRes.quoteResultCtx.oneInchFusionOrderCtx = {
                  ...onInchFusionOrderInfo,
                  signature: signHash,
                };
              }
            }
          }
        }
        const checkRes = await checkOtherFee(selectQuoteRes);
        if (!checkRes) {
          return null;
        }
        const res = await backgroundApiProxy.serviceSwap.fetchBuildTx({
          fromToken,
          toToken,
          toTokenAmount: selectQuoteRes.toAmount,
          fromTokenAmount: selectQuoteRes.fromAmount,
          slippagePercentage: slippageItem.value,
          receivingAddress: swapToAddressInfo.address,
          userAddress: swapFromAddressInfo.address,
          provider: selectQuoteRes?.info.provider,
          accountId: swapFromAddressInfo.accountInfo?.account?.id,
          quoteResultCtx: selectQuoteRes?.quoteResultCtx,
          protocol: selectQuoteRes.protocol ?? EProtocolOfExchange.SWAP,
          kind: selectQuoteRes.kind ?? ESwapQuoteKind.SELL,
        });
        let skipSendTransAction = false;
        if (res) {
          let transferInfo: ITransferInfo | undefined;
          let encodedTx: IEncodedTx | undefined;
          if (res?.swftOrder) {
            encodedTx = undefined;
            // swft order
            transferInfo = {
              from: swapFromAddressInfo.address,
              tokenInfo: {
                ...res.result.fromTokenInfo,
                isNative: !!res.result.fromTokenInfo.isNative,
                address: res.result.fromTokenInfo.contractAddress,
                name:
                  res.result.fromTokenInfo.name ??
                  res.result.fromTokenInfo.symbol,
              },
              to: res.swftOrder.platformAddr,
              amount: res.swftOrder.depositCoinAmt,
              memo: res.swftOrder.memo,
            };
          } else if (res?.changellyOrder) {
            encodedTx = undefined;
            // changelly order
            transferInfo = {
              from: swapFromAddressInfo.address,
              tokenInfo: {
                ...res.result.fromTokenInfo,
                isNative: !!res.result.fromTokenInfo.isNative,
                address: res.result.fromTokenInfo.contractAddress,
                name:
                  res.result.fromTokenInfo.name ??
                  res.result.fromTokenInfo.symbol,
              },
              to: res.changellyOrder.payinAddress,
              amount: res.changellyOrder.amountExpectedFrom,
              memo: res.changellyOrder.payinExtraId,
            };
          } else if (res?.thorSwapCallData) {
            encodedTx = undefined;
            transferInfo = {
              from: swapFromAddressInfo.address,
              tokenInfo: {
                ...res.result.fromTokenInfo,
                isNative: !!res.result.fromTokenInfo.isNative,
                address: res.result.fromTokenInfo.contractAddress,
                name:
                  res.result.fromTokenInfo.name ??
                  res.result.fromTokenInfo.symbol,
              },
              to: res.thorSwapCallData.vault,
              opReturn: res.thorSwapCallData.hasStreamingSwap
                ? res.thorSwapCallData.memoStreamingSwap
                : res.thorSwapCallData.memo,
              amount: new BigNumber(res.thorSwapCallData.amount)
                .shiftedBy(-fromToken.decimals)
                .toFixed(),
            };
          } else if (res?.OKXTxObject) {
            encodedTx =
              await backgroundApiProxy.serviceSwap.buildOkxSwapEncodedTx({
                accountId: swapFromAddressInfo?.accountInfo?.account?.id ?? '',
                networkId: res.result.fromTokenInfo.networkId,
                okxTx: res.OKXTxObject,
                fromTokenInfo: res.result.fromTokenInfo,
                type: swapTypeSwitch,
              });
          } else if (res?.tx) {
            transferInfo = undefined;
            if (typeof res.tx !== 'string' && res.tx.data) {
              const valueHex = toBigIntHex(new BigNumber(res.tx.value ?? 0));
              encodedTx = {
                ...res?.tx,
                value: valueHex,
                from: swapFromAddressInfo.address,
              };
            } else {
              encodedTx = res.tx as string;
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          } else if (
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            res?.ctx.cowSwapOrderId ||
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            res?.ctx.oneInchFusionOrderHash
          ) {
            skipSendTransAction = true;
            void Toast.success({
              title: intl.formatMessage({
                id: ETranslations.limit_toast_order_submitted,
              }),
            });
          }
          // check gasLimit
          const buildGasLimitBN = new BigNumber(res.result?.gasLimit ?? 0);
          const quoteGasLimitBN = new BigNumber(selectQuoteRes?.gasLimit ?? 0);
          if (
            (buildGasLimitBN.isNaN() || buildGasLimitBN.isZero()) &&
            !quoteGasLimitBN.isNaN() &&
            !quoteGasLimitBN.isZero()
          ) {
            res.result.gasLimit = quoteGasLimitBN.toNumber();
          }
          // check routes
          if (
            !res.result?.routesData?.length &&
            selectQuoteRes?.routesData?.length
          ) {
            res.result.routesData = selectQuoteRes.routesData;
          }

          const swapInfo: ISwapTxInfo = {
            protocol: selectQuoteRes.protocol ?? EProtocolOfExchange.SWAP,
            sender: {
              amount: res.result.fromAmount ?? selectQuoteRes.fromAmount,
              token: fromToken,
              accountInfo: {
                accountId: swapFromAddressInfo.accountInfo?.account?.id,
                networkId: fromToken.networkId,
              },
            },
            receiver: {
              amount: res.result.toAmount ?? selectQuoteRes.toAmount,
              token: toToken,
              accountInfo: {
                accountId: swapToAddressInfo.accountInfo?.account?.id,
                networkId: toToken.networkId,
              },
            },
            accountAddress: swapFromAddressInfo.address,
            receivingAddress: swapToAddressInfo.address,
            swapBuildResData: {
              ...res,
              result: {
                ...res.result,
                slippage:
                  selectQuoteRes.slippage ??
                  selectQuoteRes.autoSuggestedSlippage ??
                  slippageItem.value,
              },
            },
          };
          return {
            swapInfo,
            transferInfo,
            encodedTx,
            skipSendTransAction,
          };
        }
      } catch (e) {
        console.error(e);
      }
      return null;
    }
  }, [
    selectQuote,
    fromToken,
    toToken,
    slippageItem,
    swapFromAddressInfo.address,
    swapFromAddressInfo.networkId,
    swapFromAddressInfo.accountInfo?.account?.id,
    swapToAddressInfo.address,
    swapToAddressInfo.accountInfo?.account?.id,
    checkOtherFee,
    swapLimitExpirationTime.value,
    swapLimitPriceFromAmount,
    swapLimitPriceToAmount,
    swapLimitPartiallyFillObj.value,
    swapUseInstantRate,
    navigationToMessageConfirm,
    swapTypeSwitch,
    intl,
  ]);

  const approveTx = useCallback(
    async (amount: string, isMax?: boolean, resetApproveValue?: string) => {
      const allowanceInfo = selectQuote?.allowanceResult;
      if (
        allowanceInfo &&
        fromToken &&
        toToken &&
        swapFromAddressInfo.networkId &&
        swapFromAddressInfo.accountInfo?.account?.id &&
        swapFromAddressInfo.address
      ) {
        if (isBatchTransfer && !selectQuote?.swapShouldSignedData) {
          try {
            setSwapBuildTxFetching(true);
            let approvesInfo: IApproveInfo[] = [];
            const approveInfo: IApproveInfo = {
              owner: swapFromAddressInfo.address,
              spender: allowanceInfo.allowanceTarget,
              amount,
              isMax: resetApproveValue ? false : isMax,
              tokenInfo: {
                ...fromToken,
                isNative: !!fromToken.isNative,
                address: fromToken.contractAddress,
                name: fromToken.name ?? fromToken.symbol,
              },
              swapApproveRes: selectQuote,
            };
            approvesInfo = [approveInfo];
            if (resetApproveValue && amount === swapApproveResetValue) {
              const approveResetInfo: IApproveInfo = {
                owner: swapFromAddressInfo.address,
                spender: allowanceInfo.allowanceTarget,
                amount: resetApproveValue,
                isMax,
                tokenInfo: {
                  ...fromToken,
                  isNative: !!fromToken.isNative,
                  address: fromToken.contractAddress,
                  name: fromToken.name ?? fromToken.symbol,
                },
                swapApproveRes: selectQuote,
              };
              approvesInfo = [...approvesInfo, approveResetInfo];
            }
            const createBuildTxRes = await createBuildTx();
            if (createBuildTxRes) {
              // todo cow swap isBatchTransfer
              if (createBuildTxRes?.skipSendTransAction) {
                void handleBuildTxSuccessWithSignedNoSend({
                  swapInfo: createBuildTxRes.swapInfo,
                });
              } else {
                await navigationToTxConfirm({
                  isInternalSwap: true,
                  transfersInfo: createBuildTxRes.transferInfo
                    ? [createBuildTxRes.transferInfo]
                    : undefined,
                  encodedTx: createBuildTxRes.encodedTx,
                  swapInfo: createBuildTxRes.swapInfo,
                  approvesInfo,
                  onSuccess: handleBuildTxSuccess,
                  onCancel: cancelBuildTx,
                });

                void syncRecentTokenPairs({
                  swapFromToken: fromToken,
                  swapToToken: toToken,
                });
                defaultLogger.swap.createSwapOrder.swapCreateOrder({
                  swapProvider: selectQuote?.info.provider,
                  swapProviderName: selectQuote?.info.providerName,
                  swapType: EProtocolOfExchange.SWAP,
                  slippage: slippageItem.value.toString(),
                  sourceChain: fromToken.networkId,
                  receivedChain: toToken.networkId,
                  sourceTokenSymbol: fromToken.symbol,
                  receivedTokenSymbol: toToken.symbol,
                  feeType: selectQuote?.fee?.percentageFee?.toString() ?? '0',
                  router: JSON.stringify(selectQuote?.routesData ?? ''),
                  isFirstTime: isFirstTimeSwap,
                  createFrom:
                    pageType === EPageType.modal ? 'modal' : 'swapPage',
                });
                setPersistSettings((prev) => ({
                  ...prev,
                  isFirstTimeSwap: false,
                }));
              }
            } else {
              setSwapBuildTxFetching(false);
              setSwapShouldRefreshQuote(true);
            }
          } catch (e) {
            console.error(e);
            setSwapBuildTxFetching(false);
            setSwapShouldRefreshQuote(true);
          }
        } else {
          try {
            setSwapBuildTxFetching(true);
            const approveInfo: IApproveInfo = {
              owner: swapFromAddressInfo.address,
              spender: allowanceInfo.allowanceTarget,
              amount,
              isMax: resetApproveValue ? false : isMax,
              tokenInfo: {
                ...fromToken,
                isNative: !!fromToken.isNative,
                address: fromToken.contractAddress,
                name: fromToken.name ?? fromToken.symbol,
              },
              swapApproveRes: selectQuote,
            };
            setInAppNotificationAtom((pre) => ({
              ...pre,
              swapApprovingTransaction: {
                provider: selectQuote?.info.provider,
                fromToken,
                toToken,
                quoteId: selectQuote?.quoteId ?? '',
                amount,
                useAddress: swapFromAddressInfo.address ?? '',
                spenderAddress: allowanceInfo.allowanceTarget,
                status: ESwapApproveTransactionStatus.PENDING,
                resetApproveValue,
                resetApproveIsMax: isMax,
              },
            }));
            await navigationToTxConfirm({
              approvesInfo: [approveInfo],
              isInternalSwap: true,
              onSuccess: handleApproveTxSuccess,
              onCancel: cancelApproveTx,
            });
          } catch (e) {
            setSwapBuildTxFetching(false);
          }
        }
      }
    },
    [
      selectQuote,
      fromToken,
      toToken,
      swapFromAddressInfo.networkId,
      swapFromAddressInfo?.accountInfo?.account?.id,
      swapFromAddressInfo.address,
      isBatchTransfer,
      setSwapBuildTxFetching,
      createBuildTx,
      navigationToTxConfirm,
      handleBuildTxSuccess,
      cancelBuildTx,
      syncRecentTokenPairs,
      slippageItem.value,
      isFirstTimeSwap,
      pageType,
      setPersistSettings,
      setSwapShouldRefreshQuote,
      handleBuildTxSuccessWithSignedNoSend,
      setInAppNotificationAtom,
      handleApproveTxSuccess,
      cancelApproveTx,
    ],
  );

  const buildTx = useCallback(async () => {
    if (
      fromToken &&
      toToken &&
      selectQuote?.fromAmount &&
      slippageItem &&
      selectQuote?.toAmount &&
      swapFromAddressInfo.address &&
      swapToAddressInfo.address &&
      swapFromAddressInfo.networkId
    ) {
      setSwapBuildTxFetching(true);
      const createBuildTxRes = await createBuildTx();
      try {
        if (createBuildTxRes) {
          if (!createBuildTxRes.skipSendTransAction) {
            await navigationToTxConfirm({
              isInternalSwap: true,
              transfersInfo: createBuildTxRes.transferInfo
                ? [createBuildTxRes.transferInfo]
                : undefined,
              encodedTx: createBuildTxRes.encodedTx,
              swapInfo: createBuildTxRes.swapInfo,
              onSuccess: handleBuildTxSuccess,
              onCancel: cancelBuildTx,
            });
          } else {
            void handleBuildTxSuccessWithSignedNoSend({
              swapInfo: createBuildTxRes.swapInfo,
            });
          }
          if (
            createBuildTxRes?.swapInfo?.protocol === EProtocolOfExchange.SWAP
          ) {
            void syncRecentTokenPairs({
              swapFromToken: fromToken,
              swapToToken: toToken,
            });
          } else if (
            createBuildTxRes?.swapInfo?.protocol === EProtocolOfExchange.LIMIT
          ) {
            void backgroundApiProxy.serviceSwap.swapLimitOrdersFetchLoop(
              swapFromAddressInfo.accountInfo?.indexedAccount?.id,
              !swapFromAddressInfo.accountInfo?.indexedAccount?.id
                ? swapFromAddressInfo.accountInfo?.account?.id ??
                    swapFromAddressInfo.accountInfo?.dbAccount?.id
                : undefined,
              true,
            );
          }
          defaultLogger.swap.createSwapOrder.swapCreateOrder({
            swapProvider: selectQuote?.info.provider,
            swapProviderName: selectQuote?.info.providerName,
            swapType: EProtocolOfExchange.SWAP,
            slippage: slippageItem.value.toString(),
            sourceChain: fromToken.networkId,
            receivedChain: toToken.networkId,
            sourceTokenSymbol: fromToken.symbol,
            receivedTokenSymbol: toToken.symbol,
            feeType: selectQuote?.fee?.percentageFee?.toString() ?? '0',
            router: JSON.stringify(selectQuote?.routesData ?? ''),
            isFirstTime: isFirstTimeSwap,
            createFrom: pageType === EPageType.modal ? 'modal' : 'swapPage',
          });
          setPersistSettings((prev) => ({
            ...prev,
            isFirstTimeSwap: false,
          }));
        } else {
          setSwapBuildTxFetching(false);
          setSwapShouldRefreshQuote(true);
        }
      } catch (e) {
        setSwapBuildTxFetching(false);
        setSwapShouldRefreshQuote(true);
      }
    }
  }, [
    fromToken,
    toToken,
    selectQuote?.fromAmount,
    selectQuote?.toAmount,
    selectQuote?.info.provider,
    selectQuote?.info.providerName,
    selectQuote?.fee?.percentageFee,
    selectQuote?.routesData,
    slippageItem,
    swapFromAddressInfo.address,
    swapFromAddressInfo.networkId,
    swapFromAddressInfo.accountInfo?.indexedAccount?.id,
    swapFromAddressInfo.accountInfo?.account?.id,
    swapFromAddressInfo.accountInfo?.dbAccount?.id,
    swapToAddressInfo.address,
    setSwapBuildTxFetching,
    createBuildTx,
    isFirstTimeSwap,
    pageType,
    setPersistSettings,
    navigationToTxConfirm,
    handleBuildTxSuccess,
    cancelBuildTx,
    handleBuildTxSuccessWithSignedNoSend,
    syncRecentTokenPairs,
    setSwapShouldRefreshQuote,
  ]);

  const cancelLimitOrder = useCallback(
    async (item: IFetchLimitOrderRes) => {
      if (item.cancelInfo) {
        const { domain, types, data, signedType } = item.cancelInfo;
        const populated = await ethers.utils._TypedDataEncoder.resolveNames(
          domain,
          types,
          data,
          async (value: string) => value,
        );
        const dataMessage = JSON.stringify(
          ethers.utils._TypedDataEncoder.getPayload(
            populated.domain,
            types,
            populated.value,
          ),
        );
        if (dataMessage) {
          const signHash = await new Promise<string>((resolve, reject) => {
            if (
              dataMessage &&
              swapFromAddressInfo.address &&
              swapFromAddressInfo.networkId
            ) {
              navigationToMessageConfirm({
                accountId: swapFromAddressInfo.accountInfo?.account?.id ?? '',
                networkId: item.networkId,
                unsignedMessage: {
                  type: signedType ?? EMessageTypesEth.TYPED_DATA_V4,
                  message: dataMessage,
                  payload: [
                    swapFromAddressInfo.address.toLowerCase(),
                    dataMessage,
                  ],
                },
                walletInternalSign: true,
                onSuccess: (result: string) => {
                  resolve(result);
                },
                onFail: (error: Error) => {
                  reject(error);
                },
                onCancel: () => {
                  reject(new Error('user cancel'));
                },
              });
            } else {
              reject(
                new Error(
                  `missing data: dataMessage: ${dataMessage ?? ''}, address: ${
                    swapFromAddressInfo.address ?? ''
                  }, networkId: ${swapFromAddressInfo.networkId ?? ''}`,
                ),
              );
            }
          });
          if (signHash) {
            await backgroundApiProxy.serviceSwap.cancelLimitOrder({
              orderIds: [item.orderId],
              signature: signHash,
              signingScheme: ESigningScheme.EIP712,
              networkId: item.networkId,
              provider: item.provider,
              userAddress: item.userAddress,
            });
            await backgroundApiProxy.serviceSwap.swapLimitOrdersFetchLoop(
              swapFromAddressInfo.accountInfo?.indexedAccount?.id,
              !swapFromAddressInfo.accountInfo?.indexedAccount?.id
                ? swapFromAddressInfo.accountInfo?.account?.id ??
                    swapFromAddressInfo.accountInfo?.dbAccount?.id
                : undefined,
              true,
            );
          }
        }
      }
    },
    [swapFromAddressInfo, navigationToMessageConfirm],
  );

  return { buildTx, wrappedTx, approveTx, cancelLimitOrder };
}
