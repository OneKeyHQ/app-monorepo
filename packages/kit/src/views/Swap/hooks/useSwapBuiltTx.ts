import { useCallback, useEffect } from 'react';

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
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedMessage,
} from '@onekeyhq/core/src/types';
import {
  useInAppNotificationAtom,
  useSettingsAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IApproveInfo,
  IBuildUnsignedTxParams,
  ITransferInfo,
  IWrappedInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
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
import { ESendPreCheckTimingEnum } from '@onekeyhq/shared/types/send';
import { swapApproveResetValue } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  ESwapCancelLimitOrderSource,
  IFetchLimitOrderRes,
  IFetchQuoteResult,
  IOneInchOrderStruct,
  ISwapStep,
  ISwapToken,
  ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapApproveTransactionStatus,
  ESwapDirectionType,
  ESwapQuoteKind,
  ESwapStepStatus,
  ESwapStepType,
  EWrappedType,
} from '@onekeyhq/shared/types/swap/types';
import type {
  ISendTxBaseParams,
  ISendTxOnSuccessData,
} from '@onekeyhq/shared/types/tx';

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
  useSwapStepsAtom,
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';

import { useSwapAddressInfo } from './useSwapAccount';
import {
  useSwapActionState,
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
  const [fromTokenAmount, setSwapFromTokenAmount] =
    useSwapFromTokenAmountAtom();
  const [toTokenAmount, setSwapToTokenAmount] = useSwapToTokenAmountAtom();
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
  const [swapSteps, setSwapSteps] = useSwapStepsAtom();
  const [{ isFirstTimeSwap }, setPersistSettings] = useSettingsPersistAtom();
  const [, setSettings] = useSettingsAtom();
  const swapActionState = useSwapActionState();
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

  const onBuildTxSuccess = useCallback(
    async (txId: string, swapInfo: ISwapTxInfo) => {
      clearQuoteData();
      if (swapInfo) {
        setSwapSteps((prevSteps) => {
          const newSteps = [...prevSteps];
          newSteps[newSteps.length - 1] = {
            ...newSteps[newSteps.length - 1],
            status: ESwapStepStatus.PENDING,
            txHash: txId,
          };
          return newSteps;
        });
        await generateSwapHistoryItem({
          txId,
          swapTxInfo: swapInfo,
        });
        if (
          swapInfo.sender.token.networkId === swapInfo.receiver.token.networkId
        ) {
          void backgroundApiProxy.serviceNotification.blockNotificationForTxId({
            networkId: swapInfo.sender.token.networkId,
            tx: txId,
          });
        }
      }
    },
    [clearQuoteData, generateSwapHistoryItem, setSwapSteps],
  );

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
    async ({
      swapInfo,
      orderId,
    }: {
      orderId?: string;
      swapInfo: ISwapTxInfo;
    }) => {
      clearQuoteData();
      if (swapInfo) {
        setSwapSteps((prevSteps) => {
          const newSteps = [...prevSteps];
          newSteps[newSteps.length - 1] = {
            ...newSteps[newSteps.length - 1],
            status: ESwapStepStatus.PENDING,
            orderId,
          };
          return newSteps;
        });
        await generateSwapHistoryItem({
          swapTxInfo: swapInfo,
        });
      }
    },
    [clearQuoteData, generateSwapHistoryItem, setSwapSteps],
  );

  const handleApproveTxSuccess = useCallback(
    async (data: ISendTxOnSuccessData[]) => {
      if (data?.[0]) {
        const transactionSignedInfo = data[0].signedTx;
        const approveInfo = data[0].approveInfo;
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
                resetApproveIsMax: !!approveInfo?.isMax,
                ...(approveInfo
                  ? {
                      amount: approveInfo.amount,
                    }
                  : {}),
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
      swapFromAddressInfo.networkId &&
      swapFromAddressInfo.accountInfo?.account?.id
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
                    ? swapLimitPriceToAmount ??
                      toTokenAmount.value ??
                      unSignedOrder.buyAmount
                    : swapLimitPriceFromAmount ??
                      fromTokenAmount.value ??
                      unSignedOrder.sellAmount,
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
              // const swapInfo: ISwapTxInfo = {
              //   protocol: selectQuoteRes.protocol ?? EProtocolOfExchange.SWAP,
              //   sender: {
              //     amount: unSignedOrder.sellAmount,
              //     token: fromToken,
              //     accountInfo: {
              //       accountId: swapFromAddressInfo.accountInfo?.account?.id,
              //       networkId: fromToken.networkId,
              //     },
              //   },
              //   receiver: {
              //     amount: unSignedOrder.buyAmount,
              //     token: toToken,
              //     accountInfo: {
              //       accountId: swapToAddressInfo.accountInfo?.account?.id,
              //       networkId: toToken.networkId,
              //     },
              //   },
              //   accountAddress: swapFromAddressInfo.address,
              //   receivingAddress: swapToAddressInfo.address,
              //   swapBuildResData: {
              //     result: {
              //       ...selectQuoteRes,
              //       ...(selectQuoteRes.protocol !== EProtocolOfExchange.LIMIT
              //         ? {
              //             slippage:
              //               selectQuoteRes.slippage ?? slippageItem.value,
              //           }
              //         : {}),
              //       ...(swapUseInstantRate.rate &&
              //       selectQuoteRes.protocol === EProtocolOfExchange.LIMIT
              //         ? {
              //             instantRate: swapUseInstantRate.rate,
              //           }
              //         : {}),
              //     },
              //   },
              // };

              const signHash = await backgroundApiProxy.serviceSend.signMessage(
                {
                  unsignedMessage: {
                    type:
                      unSignedInfo.signedType ?? EMessageTypesEth.TYPED_DATA_V4,
                    message: dataMessage,
                    payload: [
                      swapFromAddressInfo.address.toLowerCase(),
                      dataMessage,
                    ],
                  },
                  networkId: swapFromAddressInfo.networkId,
                  accountId: swapFromAddressInfo.accountInfo?.account?.id,
                },
              );
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
            // const signHash = await new Promise<string>((resolve, reject) => {
            //   if (
            //     dataMessage &&
            //     swapFromAddressInfo.address &&
            //     swapFromAddressInfo.networkId
            //   ) {
            //     navigationToMessageConfirm({
            //       accountId:
            //         swapFromAddressInfo.accountInfo?.account?.id ?? '',
            //       networkId: swapFromAddressInfo.networkId,
            //       swapInfo,
            //       unsignedMessage: {
            //         type:
            //           unSignedInfo.signedType ??
            //           EMessageTypesEth.TYPED_DATA_V4,
            //         message: dataMessage,
            //         payload: [
            //           swapFromAddressInfo.address.toLowerCase(),
            //           dataMessage,
            //         ],
            //       },
            //       walletInternalSign: true,
            //       onSuccess: (result: string) => {
            //         resolve(result);
            //       },
            //       onFail: (error: Error) => {
            //         reject(error);
            //       },
            //       onCancel: () => {
            //         reject(new Error('user cancel'));
            //       },
            //     });
            //   } else {
            //     reject(
            //       new Error(
            //         `missing data: dataMessage: ${
            //           dataMessage ?? ''
            //         }, address: ${
            //           swapFromAddressInfo.address ?? ''
            //         }, networkId: ${swapFromAddressInfo.networkId ?? ''}`,
            //       ),
            //     );
            //   }
            // });
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
          walletType: swapFromAddressInfo.accountInfo?.wallet?.type,
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
                slippage: res.result.slippage ?? slippageItem.value,
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
    swapFromAddressInfo.accountInfo?.wallet?.type,
    swapToAddressInfo.address,
    swapToAddressInfo.accountInfo?.account?.id,
    checkOtherFee,
    swapLimitExpirationTime.value,
    swapLimitPriceFromAmount,
    swapLimitPriceToAmount,
    swapLimitPartiallyFillObj.value,
    toTokenAmount.value,
    fromTokenAmount.value,
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
            setInAppNotificationAtom((pre) => ({
              ...pre,
              swapApprovingLoading: true,
            }));
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
            await navigationToTxConfirm({
              approvesInfo: [approveInfo],
              isInternalSwap: true,
              onSuccess: handleApproveTxSuccess,
              onCancel: cancelApproveTx,
            });
            setInAppNotificationAtom((pre) => ({
              ...pre,
              swapApprovingTransaction: {
                swapType: swapTypeSwitch,
                protocol: selectQuote?.protocol ?? EProtocolOfExchange.SWAP,
                provider: selectQuote?.info.provider,
                providerName: selectQuote?.info.providerName,
                unSupportReceiveAddressDifferent:
                  selectQuote?.unSupportReceiveAddressDifferent,
                fromToken,
                toToken,
                quoteId: selectQuote?.quoteId ?? '',
                amount,
                toAmount: toTokenAmount?.value,
                useAddress: swapFromAddressInfo.address ?? '',
                spenderAddress: allowanceInfo.allowanceTarget,
                status: ESwapApproveTransactionStatus.PENDING,
                kind: selectQuote?.kind ?? ESwapQuoteKind.SELL,
                resetApproveValue,
                resetApproveIsMax: isMax,
              },
            }));
          } catch (e) {
            setInAppNotificationAtom((pre) => ({
              ...pre,
              swapApprovingLoading: false,
            }));
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
      toTokenAmount?.value,
      isBatchTransfer,
      swapTypeSwitch,
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
      swapFromAddressInfo.networkId &&
      swapFromAddressInfo.accountInfo?.account?.id
    ) {
      setSwapBuildTxFetching(true);
      const createBuildTxRes = await createBuildTx();
      try {
        if (createBuildTxRes) {
          if (!createBuildTxRes.skipSendTransAction) {
            // await navigationToTxConfirm({
            //   isInternalSwap: true,
            //   transfersInfo: createBuildTxRes.transferInfo
            //     ? [createBuildTxRes.transferInfo]
            //     : undefined,
            //   encodedTx: createBuildTxRes.encodedTx,
            //   swapInfo: createBuildTxRes.swapInfo,
            //   onSuccess: handleBuildTxSuccess,
            //   onCancel: cancelBuildTx,
            // });
            const unsignedTx =
              await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx(
                {
                  networkId: fromToken.networkId,
                  accountId: swapFromAddressInfo.accountInfo?.account?.id,
                  encodedTx: createBuildTxRes.encodedTx,
                  swapInfo: createBuildTxRes.swapInfo,
                  transfersInfo: createBuildTxRes.transferInfo
                    ? [createBuildTxRes.transferInfo]
                    : undefined,
                },
              );
            const res =
              await backgroundApiProxy.serviceSend.signAndSendTransaction({
                networkId: fromToken.networkId,
                accountId: swapFromAddressInfo.accountInfo?.account?.id,
                unsignedTx,
                signOnly: false,
              });
            console.log('swap__pre res', res);
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
    handleBuildTxSuccessWithSignedNoSend,
    syncRecentTokenPairs,
    setSwapShouldRefreshQuote,
  ]);

  const cancelLimitOrder = useCallback(
    async (item: IFetchLimitOrderRes, source: ESwapCancelLimitOrderSource) => {
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
        if (!swapFromAddressInfo.accountInfo?.indexedAccount?.id) {
          return;
        }
        const accounts =
          await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountId(
            {
              indexedAccountId:
                swapFromAddressInfo.accountInfo?.indexedAccount?.id,
              networkIds: [item.networkId],
            },
          );
        const orderAccount = accounts.find(
          (o) => o.network.id === item.networkId,
        );
        if (dataMessage) {
          const signHash = await new Promise<string>((resolve, reject) => {
            if (dataMessage && item.userAddress && orderAccount) {
              navigationToMessageConfirm({
                accountId: orderAccount.account?.id ?? '',
                networkId: item.networkId,
                unsignedMessage: {
                  type: signedType ?? EMessageTypesEth.TYPED_DATA_V4,
                  message: dataMessage,
                  payload: [item.userAddress.toLowerCase(), dataMessage],
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
                    orderAccount?.account?.address ?? ''
                  }, networkId: ${item.networkId ?? ''}`,
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
            defaultLogger.swap.cancelLimitOrder.cancelLimitOrder({
              cancelFrom: source,
              chain: item.networkId,
              sourceTokenSymbol: item.fromTokenInfo.symbol,
              receivedTokenSymbol: item.toTokenInfo.symbol,
              sellTokenAmount: item.fromAmount,
            });
          }
        }
      }
    },
    [swapFromAddressInfo, navigationToMessageConfirm],
  );

  const sendTxActions = useCallback(
    async (
      networkId: string,
      accountId: string,
      buildUnsignedParams: ISendTxBaseParams & IBuildUnsignedTxParams,
    ) => {
      if (
        !fromToken ||
        !swapFromAddressInfo.accountInfo?.account?.id ||
        !swapFromAddressInfo.address
      ) {
        return;
      }
      console.log(
        'swap__sendTxActions__buildUnsignedParams',
        buildUnsignedParams,
      );
      const unsignedTx =
        await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
          ...buildUnsignedParams,
          isInternalSwap: true,
        });
      console.log('swap__sendTxActions__unsignedTx', unsignedTx);

      const gasRes = await backgroundApiProxy.serviceGas.estimateFee({
        networkId,
        accountId,
        accountAddress: swapFromAddressInfo.address,
        encodedTx: unsignedTx.encodedTx,
        transfersInfo: buildUnsignedParams.transfersInfo,
      });
      console.log('swap__sendTxActions__gasRes', gasRes);

      const updatedUnsignedTx =
        await backgroundApiProxy.serviceSend.updateUnsignedTx({
          networkId,
          accountId,
          unsignedTx,
          feeInfo: {
            common: {
              baseFee: gasRes.common.baseFee,
              feeDecimals: gasRes.common.feeDecimals,
              feeSymbol: gasRes.common.feeSymbol,
              nativeDecimals: gasRes.common.nativeDecimals,
              nativeSymbol: gasRes.common.nativeSymbol,
              nativeTokenPrice: gasRes.common.nativeTokenPrice,
            },
            gas: gasRes.gas?.[1] ?? gasRes.gas?.[0],
            gasEIP1559: gasRes.gasEIP1559?.[1] ?? gasRes.gasEIP1559?.[0],
            feeUTXO: gasRes.feeUTXO?.[1] ?? gasRes.feeUTXO?.[0],
            feeTron: gasRes.feeTron?.[1] ?? gasRes.feeTron?.[0],
            feeSol: gasRes.feeSol?.[1] ?? gasRes.feeSol?.[0],
            feeCkb: gasRes.feeCkb?.[1] ?? gasRes.feeCkb?.[0],
            feeAlgo: gasRes.feeAlgo?.[1] ?? gasRes.feeAlgo?.[0],
            feeDot: gasRes.feeDot?.[1] ?? gasRes.feeDot?.[0],
            feeBudget: gasRes.feeBudget?.[1] ?? gasRes.feeBudget?.[0],
          },
        });

      await backgroundApiProxy.serviceSend.precheckUnsignedTxs({
        networkId,
        accountId,
        unsignedTxs: [updatedUnsignedTx],
        precheckTiming: ESendPreCheckTimingEnum.Confirm,
      });

      const res = await backgroundApiProxy.serviceSend.signAndSendTransaction({
        networkId,
        accountId,
        unsignedTx: updatedUnsignedTx,
        signOnly: false,
      });
      return res;
    },
    [
      fromToken,
      swapFromAddressInfo.accountInfo?.account?.id,
      swapFromAddressInfo.address,
    ],
  );

  const approveTxNew = useCallback(
    async (amount: string, isMax: boolean, data?: IFetchQuoteResult) => {
      if (
        data?.allowanceResult?.allowanceTarget &&
        swapFromAddressInfo.address
      ) {
        const approveInfo: IApproveInfo = {
          owner: swapFromAddressInfo.address,
          spender: data.allowanceResult.allowanceTarget,
          amount,
          isMax: amount === '0' ? false : isMax,
          tokenInfo: {
            ...data.fromTokenInfo,
            isNative: !!data.fromTokenInfo.isNative,
            address: data.fromTokenInfo.contractAddress,
            name: data.fromTokenInfo.name ?? data.fromTokenInfo.symbol,
          },
          swapApproveRes: data,
        };
        if (swapFromAddressInfo.accountInfo?.account?.id) {
          const res = await sendTxActions(
            data.fromTokenInfo.networkId,
            swapFromAddressInfo.accountInfo?.account?.id,
            {
              networkId: data.fromTokenInfo.networkId,
              accountId: swapFromAddressInfo.accountInfo?.account?.id,
              approveInfo,
            },
          );
          return res;
        }
      }
    },
    [
      sendTxActions,
      swapFromAddressInfo.accountInfo?.account?.id,
      swapFromAddressInfo.address,
    ],
  );

  const buildTxNew = useCallback(
    async (data?: IFetchQuoteResult) => {
      if (
        data?.fromTokenInfo &&
        data?.toTokenInfo &&
        data.fromAmount &&
        slippageItem &&
        data?.toAmount &&
        swapFromAddressInfo.address &&
        swapToAddressInfo.address &&
        swapFromAddressInfo.networkId &&
        swapFromAddressInfo.accountInfo?.account?.id
      ) {
        const checkRes = await checkOtherFee(data);
        if (!checkRes) {
          throw new OneKeyError('checkOtherFee failed');
        }
        const buildSwapRes = await backgroundApiProxy.serviceSwap.fetchBuildTx({
          fromToken: data.fromTokenInfo,
          toToken: data.toTokenInfo,
          toTokenAmount: data.toAmount,
          fromTokenAmount: data.fromAmount,
          slippagePercentage: slippageItem.value,
          receivingAddress: swapToAddressInfo.address,
          userAddress: swapFromAddressInfo.address,
          provider: data?.info.provider,
          accountId: swapFromAddressInfo.accountInfo?.account?.id,
          quoteResultCtx: data?.quoteResultCtx,
          protocol: data.protocol ?? EProtocolOfExchange.SWAP,
          kind: data.kind ?? ESwapQuoteKind.SELL,
          walletType: swapFromAddressInfo.accountInfo?.wallet?.type,
        });
        let skipSendTransAction = false;
        console.log('swap__buildTxNew__buildSwapRes', buildSwapRes);
        if (buildSwapRes) {
          let transferInfo: ITransferInfo | undefined;
          let encodedTx: IEncodedTx | undefined;
          if (buildSwapRes?.swftOrder) {
            encodedTx = undefined;
            // swft order
            transferInfo = {
              from: swapFromAddressInfo.address,
              tokenInfo: {
                ...buildSwapRes.result.fromTokenInfo,
                isNative: !!buildSwapRes.result.fromTokenInfo.isNative,
                address: buildSwapRes.result.fromTokenInfo.contractAddress,
                name:
                  buildSwapRes.result.fromTokenInfo.name ??
                  buildSwapRes.result.fromTokenInfo.symbol,
              },
              to: buildSwapRes.swftOrder.platformAddr,
              amount: buildSwapRes.swftOrder.depositCoinAmt,
              memo: buildSwapRes.swftOrder.memo,
            };
          } else if (buildSwapRes?.changellyOrder) {
            encodedTx = undefined;
            // changelly order
            transferInfo = {
              from: swapFromAddressInfo.address,
              tokenInfo: {
                ...buildSwapRes.result.fromTokenInfo,
                isNative: !!buildSwapRes.result.fromTokenInfo.isNative,
                address: buildSwapRes.result.fromTokenInfo.contractAddress,
                name:
                  buildSwapRes.result.fromTokenInfo.name ??
                  buildSwapRes.result.fromTokenInfo.symbol,
              },
              to: buildSwapRes.changellyOrder.payinAddress,
              amount: buildSwapRes.changellyOrder.amountExpectedFrom,
              memo: buildSwapRes.changellyOrder.payinExtraId,
            };
          } else if (buildSwapRes?.thorSwapCallData) {
            encodedTx = undefined;
            transferInfo = {
              from: swapFromAddressInfo.address,
              tokenInfo: {
                ...buildSwapRes.result.fromTokenInfo,
                isNative: !!buildSwapRes.result.fromTokenInfo.isNative,
                address: buildSwapRes.result.fromTokenInfo.contractAddress,
                name:
                  buildSwapRes.result.fromTokenInfo.name ??
                  buildSwapRes.result.fromTokenInfo.symbol,
              },
              to: buildSwapRes.thorSwapCallData.vault,
              opReturn: buildSwapRes.thorSwapCallData.hasStreamingSwap
                ? buildSwapRes.thorSwapCallData.memoStreamingSwap
                : buildSwapRes.thorSwapCallData.memo,
              amount: new BigNumber(buildSwapRes.thorSwapCallData.amount)
                .shiftedBy(-data.fromTokenInfo.decimals)
                .toFixed(),
            };
          } else if (buildSwapRes?.OKXTxObject) {
            encodedTx =
              await backgroundApiProxy.serviceSwap.buildOkxSwapEncodedTx({
                accountId: swapFromAddressInfo?.accountInfo?.account?.id ?? '',
                networkId: buildSwapRes.result.fromTokenInfo.networkId,
                okxTx: buildSwapRes.OKXTxObject,
                fromTokenInfo: buildSwapRes.result.fromTokenInfo,
                type: swapTypeSwitch,
              });
          } else if (buildSwapRes?.tx) {
            transferInfo = undefined;
            if (typeof buildSwapRes.tx !== 'string' && buildSwapRes.tx.data) {
              const valueHex = toBigIntHex(
                new BigNumber(buildSwapRes.tx.value ?? 0),
              );
              encodedTx = {
                ...buildSwapRes?.tx,
                value: valueHex,
                from: swapFromAddressInfo.address,
              };
            } else {
              encodedTx = buildSwapRes.tx as string;
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          } else if (
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            buildSwapRes?.ctx.cowSwapOrderId ||
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            buildSwapRes?.ctx.oneInchFusionOrderHash
          ) {
            skipSendTransAction = true;
            void Toast.success({
              title: intl.formatMessage({
                id: ETranslations.limit_toast_order_submitted,
              }),
            });
          }
          // check gasLimit
          const buildGasLimitBN = new BigNumber(
            buildSwapRes.result?.gasLimit ?? 0,
          );
          const quoteGasLimitBN = new BigNumber(data?.gasLimit ?? 0);
          if (
            (buildGasLimitBN.isNaN() || buildGasLimitBN.isZero()) &&
            !quoteGasLimitBN.isNaN() &&
            !quoteGasLimitBN.isZero()
          ) {
            buildSwapRes.result.gasLimit = quoteGasLimitBN.toNumber();
          }
          // check routes
          if (
            !buildSwapRes.result?.routesData?.length &&
            data?.routesData?.length
          ) {
            buildSwapRes.result.routesData = data.routesData;
          }

          const swapInfo: ISwapTxInfo = {
            protocol: buildSwapRes.result.protocol ?? EProtocolOfExchange.SWAP,
            sender: {
              amount: buildSwapRes.result.fromAmount ?? data.fromAmount,
              token: buildSwapRes.result.fromTokenInfo,
              accountInfo: {
                accountId: swapFromAddressInfo.accountInfo?.account?.id,
                networkId: buildSwapRes.result.fromTokenInfo.networkId,
              },
            },
            receiver: {
              amount: buildSwapRes.result.toAmount ?? data.toAmount,
              token: buildSwapRes.result.toTokenInfo,
              accountInfo: {
                accountId: swapToAddressInfo.accountInfo?.account?.id,
                networkId: buildSwapRes.result.toTokenInfo.networkId,
              },
            },
            accountAddress: swapFromAddressInfo.address,
            receivingAddress: swapToAddressInfo.address,
            swapBuildResData: {
              ...buildSwapRes,
              result: {
                ...buildSwapRes.result,
                slippage: buildSwapRes.result.slippage ?? slippageItem.value,
              },
            },
          };
          if (skipSendTransAction) {
            void handleBuildTxSuccessWithSignedNoSend({
              swapInfo,
              orderId:
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                buildSwapRes?.ctx.cowSwapOrderId ??
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                buildSwapRes?.ctx.oneInchFusionOrderHash ??
                '',
            });
          } else {
            console.log('swap__buildTxNew__sendTxActions_swapInfo:', swapInfo);
            const sendTxRes = await sendTxActions(
              buildSwapRes.result.fromTokenInfo.networkId,
              swapFromAddressInfo.accountInfo?.account?.id,
              {
                networkId: buildSwapRes.result.fromTokenInfo.networkId,
                accountId: swapFromAddressInfo.accountInfo?.account?.id,
                transfersInfo: transferInfo ? [transferInfo] : undefined,
                encodedTx,
                swapInfo,
              },
            );
            if (sendTxRes) {
              void onBuildTxSuccess(sendTxRes.txid, swapInfo);
            }
          }
          let swapType = EProtocolOfExchange.SWAP;
          if (buildSwapRes?.result?.protocol === EProtocolOfExchange.SWAP) {
            void syncRecentTokenPairs({
              swapFromToken: buildSwapRes.result.fromTokenInfo,
              swapToToken: buildSwapRes.result.toTokenInfo,
            });
          } else if (
            buildSwapRes?.result?.protocol === EProtocolOfExchange.LIMIT
          ) {
            swapType = EProtocolOfExchange.LIMIT;
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
            swapProvider: buildSwapRes.result?.info.provider ?? '',
            swapProviderName: buildSwapRes.result?.info.providerName ?? '',
            swapType,
            slippage: slippageItem.value.toString(),
            sourceChain: buildSwapRes.result.fromTokenInfo.networkId,
            receivedChain: buildSwapRes.result.toTokenInfo.networkId,
            sourceTokenSymbol: buildSwapRes.result.fromTokenInfo.symbol,
            receivedTokenSymbol: buildSwapRes.result.toTokenInfo.symbol,
            feeType: buildSwapRes.result?.fee?.percentageFee?.toString() ?? '0',
            router: JSON.stringify(buildSwapRes.result?.routesData ?? ''),
            isFirstTime: isFirstTimeSwap,
            createFrom: pageType === EPageType.modal ? 'modal' : 'swapPage',
          });
          setPersistSettings((prev) => ({
            ...prev,
            isFirstTimeSwap: false,
          }));
        }
      }
    },
    [
      checkOtherFee,
      handleBuildTxSuccessWithSignedNoSend,
      intl,
      isFirstTimeSwap,
      onBuildTxSuccess,
      pageType,
      sendTxActions,
      setPersistSettings,
      slippageItem,
      swapFromAddressInfo.accountInfo?.account?.id,
      swapFromAddressInfo.accountInfo?.dbAccount?.id,
      swapFromAddressInfo.accountInfo?.indexedAccount?.id,
      swapFromAddressInfo.accountInfo?.wallet?.type,
      swapFromAddressInfo.address,
      swapFromAddressInfo.networkId,
      swapToAddressInfo.accountInfo?.account?.id,
      swapToAddressInfo.address,
      swapTypeSwitch,
      syncRecentTokenPairs,
    ],
  );

  const signMessage = useCallback(
    async (data?: IFetchQuoteResult) => {
      if (
        data?.fromTokenInfo &&
        data?.toTokenInfo &&
        data.fromAmount &&
        slippageItem &&
        data?.toAmount &&
        swapFromAddressInfo.address &&
        swapToAddressInfo.address &&
        swapFromAddressInfo.networkId &&
        swapFromAddressInfo.accountInfo?.account?.id
      ) {
        const selectQuoteRes = cloneDeep(data);
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
                selectQuoteRes.protocol === EProtocolOfExchange.LIMIT &&
                (swapLimitPriceFromAmount || swapLimitPriceToAmount)
              ) {
                const decimals =
                  selectQuoteRes.kind === ESwapQuoteKind.SELL
                    ? selectQuoteRes.toTokenInfo.decimals
                    : selectQuoteRes.fromTokenInfo.decimals;
                const finalAmountBN = new BigNumber(
                  selectQuoteRes.kind === ESwapQuoteKind.SELL
                    ? swapLimitPriceToAmount ??
                      selectQuoteRes.toAmount ??
                      unSignedOrder.buyAmount
                    : swapLimitPriceFromAmount ??
                      selectQuoteRes.fromAmount ??
                      unSignedOrder.sellAmount,
                ).shiftedBy(decimals);
                if (selectQuoteRes.kind === ESwapQuoteKind.SELL) {
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
              const signHash = await backgroundApiProxy.serviceSend.signMessage(
                {
                  unsignedMessage: {
                    type:
                      unSignedInfo.signedType ?? EMessageTypesEth.TYPED_DATA_V4,
                    message: dataMessage,
                    payload: [
                      swapFromAddressInfo.address.toLowerCase(),
                      dataMessage,
                    ],
                  },
                  networkId: swapFromAddressInfo.networkId,
                  accountId: swapFromAddressInfo.accountInfo?.account?.id,
                },
              );
              if (signHash) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                selectQuoteRes.quoteResultCtx.cowSwapUnSignedOrder =
                  unSignedOrder;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                selectQuoteRes.quoteResultCtx.signedResult = {
                  signature: signHash,
                  signingScheme: ESigningScheme.EIP712,
                };
                const buildTxRes = await buildTxNew(selectQuoteRes);
                return buildTxRes;
              }
              throw new OneKeyError('sign message failed');
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
              const dataMessage = JSON.stringify(typedData);
              const signHash = await backgroundApiProxy.serviceSend.signMessage(
                {
                  unsignedMessage: {
                    type:
                      unSignedInfo.signedType ?? EMessageTypesEth.TYPED_DATA_V4,
                    message: dataMessage,
                    payload: [
                      swapFromAddressInfo.address.toLowerCase(),
                      dataMessage,
                    ],
                  },
                  networkId: swapFromAddressInfo.networkId,
                  accountId: swapFromAddressInfo.accountInfo?.account?.id,
                },
              );
              if (signHash) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                selectQuoteRes.quoteResultCtx.oneInchFusionOrderCtx = {
                  ...onInchFusionOrderInfo,
                  signature: signHash,
                };
                const buildTxRes = await buildTxNew(selectQuoteRes);
                return buildTxRes;
              }
              throw new OneKeyError('sign message failed');
            }
          }
        }
      }
    },
    [
      buildTxNew,
      slippageItem,
      swapFromAddressInfo.accountInfo?.account?.id,
      swapFromAddressInfo.address,
      swapFromAddressInfo.networkId,
      swapLimitExpirationTime.value,
      swapLimitPartiallyFillObj.value,
      swapLimitPriceFromAmount,
      swapLimitPriceToAmount,
      swapToAddressInfo.address,
    ],
  );

  const wrappedTx = useCallback(
    async (
      data?: IFetchQuoteResult,
      fromTokenInfo?: ISwapToken,
      toTokenInfo?: ISwapToken,
    ) => {
      console.log('swap__buildTxNew__wrappedTx_data:', data);
      if (
        fromTokenInfo &&
        toTokenInfo &&
        swapFromAddressInfo.address &&
        swapToAddressInfo.address &&
        data?.fromAmount &&
        swapFromAddressInfo.accountInfo?.account?.id
      ) {
        setSwapBuildTxFetching(true);
        const wrappedType = fromTokenInfo.isNative
          ? EWrappedType.DEPOSIT
          : EWrappedType.WITHDRAW;
        const wrappedInfo: IWrappedInfo = {
          from: swapFromAddressInfo.address,
          type: wrappedType,
          contract:
            wrappedType === EWrappedType.WITHDRAW
              ? fromTokenInfo.contractAddress
              : toTokenInfo.contractAddress,
          amount: data.fromAmount ?? '',
        };
        const swapInfo = {
          protocol: data?.protocol ?? EProtocolOfExchange.SWAP,
          sender: {
            amount: data.fromAmount ?? '',
            token: fromTokenInfo,
            accountInfo: {
              accountId: swapFromAddressInfo.accountInfo?.account?.id,
              networkId: fromTokenInfo.networkId,
            },
          },
          receiver: {
            amount: data.toAmount ?? '',
            token: toTokenInfo,
            accountInfo: {
              accountId: swapToAddressInfo.accountInfo?.account?.id,
              networkId: toTokenInfo.networkId,
            },
          },
          accountAddress: swapFromAddressInfo.address,
          receivingAddress: swapToAddressInfo.address ?? '',
          swapBuildResData: { result: data },
        };

        const sendTxRes = await sendTxActions(
          fromTokenInfo.networkId,
          swapFromAddressInfo.accountInfo?.account?.id,
          {
            networkId: fromTokenInfo.networkId,
            accountId: swapFromAddressInfo.accountInfo?.account?.id,
            wrappedInfo,
            swapInfo,
          },
        );

        console.log('swap__pre wrapped res', sendTxRes);
        if (sendTxRes) {
          void syncRecentTokenPairs({
            swapFromToken: data.fromTokenInfo,
            swapToToken: data.toTokenInfo,
          });
          void onBuildTxSuccess(sendTxRes.txid, swapInfo);
          return sendTxRes;
        }
      }
    },
    [
      swapFromAddressInfo.address,
      swapFromAddressInfo.accountInfo?.account?.id,
      swapToAddressInfo.address,
      swapToAddressInfo.accountInfo?.account?.id,
      setSwapBuildTxFetching,
      sendTxActions,
      syncRecentTokenPairs,
      onBuildTxSuccess,
    ],
  );

  const batchApproveSwap = useCallback(
    async (data?: IFetchQuoteResult) => {
      if (
        data?.fromTokenInfo &&
        data?.toTokenInfo &&
        data.fromAmount &&
        slippageItem &&
        data?.toAmount &&
        swapFromAddressInfo.address &&
        swapToAddressInfo.address &&
        swapFromAddressInfo.networkId &&
        swapFromAddressInfo.accountInfo?.account?.id
      ) {
        if (data.allowanceResult) {
          if (data.allowanceResult.shouldResetApprove) {
            await approveTxNew('0', !!swapActionState.approveUnLimit, data);
          }
          await approveTxNew(
            data.fromAmount,
            !!swapActionState.approveUnLimit,
            data,
          );
        }
        await buildTxNew(data);
      }
    },
    [
      slippageItem,
      swapFromAddressInfo.address,
      swapFromAddressInfo.networkId,
      swapFromAddressInfo.accountInfo?.account?.id,
      swapToAddressInfo.address,
      buildTxNew,
      approveTxNew,
      swapActionState.approveUnLimit,
    ],
  );
  const preSwapStepsStart = useCallback(async () => {
    if (swapSteps.length > 0) {
      for (let i = 0; i < swapSteps.length; i += 1) {
        const step = swapSteps[i];
        const { type, isResetApprove, data, canRetry, status } = step;
        if (
          status === ESwapStepStatus.READY ||
          (canRetry && status === ESwapStepStatus.FAILED)
        ) {
          try {
            setSwapSteps((prevSteps) => {
              const newSteps = [...prevSteps];
              newSteps[i] = {
                ...newSteps[i],
                status: ESwapStepStatus.LOADING,
                errorMessage: undefined,
              };
              return newSteps;
            });
            if (type === ESwapStepType.APPROVE_TX) {
              let approveAmount = data?.fromAmount ?? '0';
              let approveSendTx: ISignedTxPro | undefined;
              if (isResetApprove) {
                approveAmount = '0';
                approveSendTx = await approveTxNew(
                  approveAmount,
                  !!swapActionState.approveUnLimit,
                  step.data,
                );
              } else {
                approveSendTx = await approveTxNew(
                  approveAmount,
                  !!swapActionState.approveUnLimit,
                  step.data,
                );
              }
              if (step.shouldWaitApproved && approveSendTx) {
                setSwapSteps((prevSteps: ISwapStep[]) => {
                  const newSteps = [...prevSteps];
                  newSteps[i] = {
                    ...newSteps[i],
                    status: ESwapStepStatus.PENDING,
                    txHash: approveSendTx.txid,
                  };
                  return newSteps;
                });
                if (data?.fromTokenInfo && data?.toTokenInfo) {
                  setInAppNotificationAtom((pre) => ({
                    ...pre,
                    swapApprovingTransaction: {
                      txId: approveSendTx.txid,
                      swapType: swapTypeSwitch,
                      protocol: data?.protocol ?? EProtocolOfExchange.SWAP,
                      provider: data?.info.provider,
                      providerName: data?.info.providerName,
                      unSupportReceiveAddressDifferent:
                        data?.unSupportReceiveAddressDifferent,
                      fromToken: data?.fromTokenInfo,
                      toToken: data?.toTokenInfo,
                      quoteId: data?.quoteId ?? '',
                      amount: approveAmount,
                      toAmount: data?.toAmount ?? '',
                      useAddress: swapFromAddressInfo.address ?? '',
                      spenderAddress:
                        data?.allowanceResult?.allowanceTarget ?? '',
                      status: ESwapApproveTransactionStatus.PENDING,
                      kind: selectQuote?.kind ?? ESwapQuoteKind.SELL,
                      resetApproveIsMax: !!swapActionState.approveUnLimit,
                    },
                  }));
                }
                break;
              }
            } else if (type === ESwapStepType.WRAP_TX) {
              await wrappedTx(step.data, step.fromToken, step.toToken);
            } else if (type === ESwapStepType.SEND_TX) {
              console.log(
                'swap__buildTxNew__sendTxActions_step.data:',
                step.data,
              );
              await buildTxNew(step.data);
            } else if (type === ESwapStepType.SIGN_MESSAGE) {
              await signMessage(step.data);
            } else if (type === ESwapStepType.BATCH_APPROVE_SWAP) {
              await batchApproveSwap(step.data);
            }

            // todo  等待 approve 上链
            // 设置步骤为成功状态
            if (type === ESwapStepType.APPROVE_TX && step.shouldWaitApproved) {
              setSwapSteps((prevSteps) => {
                const newSteps = [...prevSteps];
                newSteps[i] = {
                  ...newSteps[i],
                  status: ESwapStepStatus.PENDING,
                };
                return newSteps;
              });
            } else if (i !== swapSteps.length - 1) {
              setSwapSteps((prevSteps) => {
                const newSteps = [...prevSteps];
                newSteps[i] = {
                  ...newSteps[i],
                  status: ESwapStepStatus.SUCCESS,
                };
                return newSteps;
              });
            }
          } catch (error) {
            console.error(`swap__Step ${i} failed:`, error);

            setSwapSteps((prevSteps) => {
              const newSteps = [...prevSteps];
              newSteps[i] = {
                ...newSteps[i],
                status: ESwapStepStatus.FAILED,
                errorMessage:
                  error instanceof Error ? error.message : 'Unknown error',
              };
              return newSteps;
            });
            break;
          }
        }
      }
    }
  }, [
    swapSteps,
    setSwapSteps,
    approveTxNew,
    swapActionState.approveUnLimit,
    setInAppNotificationAtom,
    swapTypeSwitch,
    swapFromAddressInfo.address,
    selectQuote?.kind,
    wrappedTx,
    buildTxNew,
    signMessage,
    batchApproveSwap,
  ]);

  return { preSwapStepsStart, cancelLimitOrder };
}
