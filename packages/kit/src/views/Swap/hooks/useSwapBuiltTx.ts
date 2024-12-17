import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { EPageType, Toast, usePageType } from '@onekeyhq/components';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import {
  useInAppNotificationAtom,
  useSettingsAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EWrappedType } from '@onekeyhq/kit-bg/src/vaults/types';
import type {
  IApproveInfo,
  ITransferInfo,
  IWrappedInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  numberFormat,
  toBigIntHex,
} from '@onekeyhq/shared/src/utils/numberUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import { swapApproveResetValue } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapApproveTransactionStatus,
  ESwapDirectionType,
  SwapBuildUseMultiplePopoversNetworkIds,
} from '@onekeyhq/shared/types/swap/types';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useSendConfirm } from '../../../hooks/useSendConfirm';
import {
  useSwapBuildTxFetchingAtom,
  useSwapFromTokenAmountAtom,
  useSwapManualSelectQuoteProvidersAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapQuoteEventTotalCountAtom,
  useSwapQuoteListAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapShouldRefreshQuoteAtom,
} from '../../../states/jotai/contexts/swap';

import { useSwapAddressInfo } from './useSwapAccount';
import { useSwapSlippagePercentageModeInfo } from './useSwapState';
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
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const [, setSwapFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [, setSwapShouldRefreshQuote] = useSwapShouldRefreshQuoteAtom();
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const swapToAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  const [, setSwapManualSelectQuoteProviders] =
    useSwapManualSelectQuoteProvidersAtom();
  const { generateSwapHistoryItem } = useSwapTxHistoryActions();
  const [{ isFirstTimeSwap }, setPersistSettings] = useSettingsPersistAtom();
  const [, setSettings] = useSettingsAtom();
  const { navigationToSendConfirm } = useSendConfirm({
    accountId: swapFromAddressInfo.accountInfo?.account?.id ?? '',
    networkId: swapFromAddressInfo.networkId ?? '',
  });
  const pageType = usePageType();
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

  const handleBuildTxSuccess = useCallback(
    async (data: ISendTxOnSuccessData[]) => {
      if (data?.[0]) {
        setSwapFromTokenAmount(''); // send success, clear from token amount
        setSwapQuoteResultList([]);
        setSwapQuoteEventTotalCount({
          count: 0,
        });
        setSettings((v) => ({
          // reset account switch for reset swap receive address
          ...v,
          swapToAnotherAccountSwitchOn: false,
        }));
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
    [
      generateSwapHistoryItem,
      setSwapBuildTxFetching,
      setSwapFromTokenAmount,
      setSwapQuoteResultList,
      setSwapQuoteEventTotalCount,
      setSettings,
    ],
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
      await navigationToSendConfirm({
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
    navigationToSendConfirm,
    handleBuildTxSuccess,
    handleTxFail,
    syncRecentTokenPairs,
  ]);

  const createBuildTx = useCallback(async () => {
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
      try {
        const checkRes = await checkOtherFee(selectQuote);
        if (!checkRes) {
          return null;
        }
        const res = await backgroundApiProxy.serviceSwap.fetchBuildTx({
          fromToken,
          toToken,
          toTokenAmount: selectQuote.toAmount,
          fromTokenAmount: selectQuote.fromAmount,
          slippagePercentage: slippageItem.value,
          receivingAddress: swapToAddressInfo.address,
          userAddress: swapFromAddressInfo.address,
          provider: selectQuote?.info.provider,
          accountId: swapFromAddressInfo.accountInfo?.account?.id,
          quoteResultCtx: selectQuote?.quoteResultCtx,
        });
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
          }
          // check gasLimit
          const buildGasLimitBN = new BigNumber(res.result?.gasLimit ?? 0);
          const quoteGasLimitBN = new BigNumber(selectQuote?.gasLimit ?? 0);
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
            selectQuote?.routesData?.length
          ) {
            res.result.routesData = selectQuote.routesData;
          }

          const swapInfo = {
            sender: {
              amount: selectQuote.fromAmount,
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
            swapBuildResData: res,
          };
          return { swapInfo, transferInfo, encodedTx };
        }
      } catch (e) {
        console.error(e);
      }
      return null;
    }
  }, [
    fromToken,
    toToken,
    selectQuote,
    slippageItem,
    swapFromAddressInfo.address,
    swapFromAddressInfo.networkId,
    swapFromAddressInfo.accountInfo?.account?.id,
    swapToAddressInfo.address,
    swapToAddressInfo.accountInfo?.account?.id,
    checkOtherFee,
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
        if (settingsPersistAtom.swapBatchApproveAndSwap) {
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
              if (
                accountUtils.isHwAccount({
                  accountId: swapFromAddressInfo.accountInfo.account.id,
                }) ||
                accountUtils.isExternalAccount({
                  accountId: swapFromAddressInfo.accountInfo.account.id,
                }) ||
                SwapBuildUseMultiplePopoversNetworkIds.includes(
                  fromToken.networkId,
                )
              ) {
                await navigationToSendConfirm({
                  approvesInfo: [approvesInfo[0]],
                  isInternalSwap: true,
                  onSuccess: async (data: ISendTxOnSuccessData[]) => {
                    if (approvesInfo.length > 1) {
                      await navigationToSendConfirm({
                        approvesInfo: [approvesInfo[1]],
                        // tron network does not support use pre fee info
                        feeInfo:
                          SwapBuildUseMultiplePopoversNetworkIds.includes(
                            fromToken.networkId,
                          )
                            ? undefined
                            : data?.[0]?.feeInfo,
                        isInternalSwap: true,
                        onSuccess: async (dataRes: ISendTxOnSuccessData[]) => {
                          await navigationToSendConfirm({
                            transfersInfo: createBuildTxRes.transferInfo
                              ? [createBuildTxRes.transferInfo]
                              : undefined,
                            encodedTx: createBuildTxRes.encodedTx,
                            feeInfo:
                              SwapBuildUseMultiplePopoversNetworkIds.includes(
                                fromToken.networkId,
                              )
                                ? undefined
                                : dataRes?.[0]?.feeInfo,
                            swapInfo: createBuildTxRes.swapInfo,
                            isInternalSwap: true,
                            onSuccess: handleBuildTxSuccess,
                            onCancel: cancelBuildTx,
                          });
                        },
                        onCancel: cancelBuildTx,
                      });
                    } else {
                      await navigationToSendConfirm({
                        transfersInfo: createBuildTxRes.transferInfo
                          ? [createBuildTxRes.transferInfo]
                          : undefined,
                        encodedTx: createBuildTxRes.encodedTx,
                        swapInfo: createBuildTxRes.swapInfo,
                        feeInfo:
                          SwapBuildUseMultiplePopoversNetworkIds.includes(
                            fromToken.networkId,
                          )
                            ? undefined
                            : data?.[0]?.feeInfo,
                        isInternalSwap: true,
                        onSuccess: handleBuildTxSuccess,
                        onCancel: cancelBuildTx,
                      });
                    }
                  },
                  onCancel: cancelBuildTx,
                });
              } else {
                await navigationToSendConfirm({
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
              }
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
                amount,
                useAddress: swapFromAddressInfo.address ?? '',
                spenderAddress: allowanceInfo.allowanceTarget,
                status: ESwapApproveTransactionStatus.PENDING,
                resetApproveValue,
                resetApproveIsMax: isMax,
              },
            }));
            await navigationToSendConfirm({
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
      swapFromAddressInfo.accountInfo?.account?.id,
      swapFromAddressInfo.address,
      settingsPersistAtom.swapBatchApproveAndSwap,
      setSwapBuildTxFetching,
      createBuildTx,
      syncRecentTokenPairs,
      slippageItem.value,
      isFirstTimeSwap,
      pageType,
      setPersistSettings,
      navigationToSendConfirm,
      cancelBuildTx,
      handleBuildTxSuccess,
      setSwapShouldRefreshQuote,
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
          await navigationToSendConfirm({
            isInternalSwap: true,
            transfersInfo: createBuildTxRes.transferInfo
              ? [createBuildTxRes.transferInfo]
              : undefined,
            encodedTx: createBuildTxRes.encodedTx,
            swapInfo: createBuildTxRes.swapInfo,
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
    swapToAddressInfo.address,
    setSwapBuildTxFetching,
    createBuildTx,
    navigationToSendConfirm,
    handleBuildTxSuccess,
    cancelBuildTx,
    syncRecentTokenPairs,
    isFirstTimeSwap,
    pageType,
    setPersistSettings,
    setSwapShouldRefreshQuote,
  ]);

  return { buildTx, wrappedTx, approveTx };
}
