import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import type { IEncodedTx } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSelectedDeriveTypeAtom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  ITransferInfo,
  IWrappedInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { presetNetworksMap } from '@onekeyhq/shared/src/config/presetNetworks';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ESwapEventAPIStatus } from '@onekeyhq/shared/src/logger/scopes/swap/scenes/swapEstimateFee';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import {
  checkWrappedTokenPair,
  equalTokenNoCaseSensitive,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import { wrappedTokens } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  IFetchQuoteResult,
  ISwapNativeTokenReserveGas,
  ISwapToken,
  ISwapTokenBase,
  ISwapTxHistory,
  ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapFetchCancelCause,
  ESwapQuoteKind,
  ESwapTabSwitchType,
  ESwapTxHistoryStatus,
  EWrappedType,
} from '@onekeyhq/shared/types/swap/types';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import {
  buildMarketSwapApproveInfos,
  createWrappedMarketSwapReviewQuote,
} from '../utils/reviewUtils';

import { ESwapDirection } from './useTradeType';

type ISpeedSwapSubmitOptions = {
  onCancel?: () => void;
  onSuccess?: () => void;
  reviewQuote?: IFetchQuoteResult;
};

export function useSpeedSwapActions(props: {
  marketToken: ISwapToken;
  tradeToken: ISwapTokenBase;
  tradeType: ESwapDirection;
  fromTokenAmount: string;
  provider: string;
  spenderAddress: string;
  slippage: number;
  defaultTradeTokens: ISwapTokenBase[];
  antiMEV: boolean;
}) {
  const {
    marketToken,
    fromTokenAmount,
    tradeToken,
    tradeType,
    provider,
    spenderAddress,
    slippage,
    defaultTradeTokens,
    antiMEV,
  } = props;

  const [settingsAtom] = useSettingsPersistAtom();
  const { activeAccount: account } = useActiveAccount({ num: 0 });
  const [shouldApprove, setShouldApprove] = useState(false);
  const [shouldResetApprove, setShouldResetApprove] = useState(false);
  const [speedSwapBuildTxLoading, setSpeedSwapBuildTxLoading] = useState(false);
  const [checkTokenAllowanceLoading, setCheckTokenAllowanceLoading] =
    useState(false);
  const [fetchBalanceLoading, setFetchBalanceLoading] = useState(false);
  const [swapNativeTokenReserveGas, setSwapNativeTokenReserveGas] = useState<
    ISwapNativeTokenReserveGas[]
  >([]);
  const [{ isFirstTimeSwap }] = useSettingsPersistAtom();
  const [priceRate, setPriceRate] = useState<
    | {
        rate?: number;
        fromTokenSymbol?: string;
        toTokenSymbol?: string;
        loading?: boolean;
      }
    | undefined
  >(undefined);
  const [balance, setBalance] = useState<BigNumber | undefined>(
    new BigNumber(0),
  );
  const [speedCheckError, setSpeedCheckError] = useState('');
  const [speedCheckLoading, setSpeedCheckLoading] = useState(false);
  const [checkSpenderAddress, setCheckSpenderAddress] = useState('');
  const speedCheckRequestIdRef = useRef(0);

  const effectiveSpenderAddress = checkSpenderAddress || spenderAddress;

  const [tradeTokenDetail, setTradeTokenDetail] =
    useState<ISwapToken>(tradeToken);

  const { fromToken, toToken, balanceToken } = useMemo(() => {
    if (tradeType === ESwapDirection.BUY) {
      return {
        fromToken: tradeTokenDetail,
        toToken: marketToken,
        balanceToken: tradeTokenDetail,
      };
    }
    return {
      fromToken: marketToken,
      toToken: tradeTokenDetail,
      balanceToken: marketToken,
    };
  }, [tradeType, marketToken, tradeTokenDetail]);

  // Use atom to get selected derive type from Market Detail page
  const [selectedDeriveType] = useSelectedDeriveTypeAtom();

  const netAccountRes = usePromiseResult(async () => {
    try {
      const defaultDeriveType =
        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId: balanceToken?.networkId ?? '',
        });

      // Prioritize Market Detail page selected derive type over global
      const effectiveDeriveType =
        selectedDeriveType ?? defaultDeriveType ?? 'default';

      const res = await backgroundApiProxy.serviceAccount.getNetworkAccount({
        accountId: account?.indexedAccount?.id
          ? undefined
          : account?.account?.id,
        indexedAccountId: account?.indexedAccount?.id ?? '',
        networkId: balanceToken?.networkId,
        deriveType: effectiveDeriveType,
      });
      return res;
    } catch (_e) {
      return undefined;
    }
  }, [account, balanceToken?.networkId, selectedDeriveType]);

  // Listen for derive type changes and re-fetch network account
  useEffect(() => {
    const handleDeriveTypeChanged = () => {
      void netAccountRes.run();
    };
    appEventBus.off(
      EAppEventBusNames.NetworkDeriveTypeChanged,
      handleDeriveTypeChanged,
    );
    appEventBus.on(
      EAppEventBusNames.NetworkDeriveTypeChanged,
      handleDeriveTypeChanged,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.NetworkDeriveTypeChanged,
        handleDeriveTypeChanged,
      );
    };
  }, [netAccountRes]);

  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId: netAccountRes.result?.id ?? '',
    networkId: marketToken?.networkId,
  });
  const fromTokenAmountDebounced = useDebounce(fromTokenAmount, 300, {
    leading: true,
  });
  const actionFromTokenAmount = useMemo(() => {
    const currentAmountBN = new BigNumber(fromTokenAmount || 0);
    if (!currentAmountBN.isNaN() && currentAmountBN.gt(0)) {
      return currentAmountBN.toFixed();
    }

    const debouncedAmountBN = new BigNumber(fromTokenAmountDebounced || 0);
    if (!debouncedAmountBN.isNaN() && debouncedAmountBN.gt(0)) {
      return debouncedAmountBN.toFixed();
    }

    return '';
  }, [fromTokenAmount, fromTokenAmountDebounced]);

  const tradeTokenRef = useRef<ISwapToken>(undefined);
  if (tradeTokenRef.current !== tradeToken) {
    tradeTokenRef.current = tradeToken;
  }
  const tradeTokenNetworkId = tradeToken.networkId;
  const tradeTokenContractAddress = tradeToken.contractAddress;
  useEffect(() => {
    void (async () => {
      if (!tradeTokenNetworkId) return;
      const tokenDetail =
        await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
          networkId: tradeTokenNetworkId,
          contractAddress: tradeTokenContractAddress,
          currency: 'usd',
        });
      if (tokenDetail?.length) {
        setTradeTokenDetail({
          ...tokenDetail[0],
          symbol: tradeTokenRef.current?.symbol ?? '',
          logoURI: tokenDetail[0]?.logoURI
            ? tokenDetail[0]?.logoURI
            : (tradeTokenRef.current?.logoURI ?? ''),
        });
      }
    })();
  }, [
    tradeType,
    defaultTradeTokens,
    tradeTokenNetworkId,
    tradeTokenContractAddress,
  ]);

  // --- build tx

  const handleSpeedSwapBuildTxSuccess = useCallback(
    async (data: ISendTxOnSuccessData[]) => {
      setSpeedSwapBuildTxLoading(false);
      const transactionSignedInfo = data[0].signedTx;
      const transactionDecodedInfo = data[0].decodedTx;
      const txId = transactionSignedInfo.txid;
      const { swapInfo } = transactionSignedInfo;
      const {
        totalFeeInNative,
        totalFeeFiatValue,
        networkId: txNetworkId,
      } = transactionDecodedInfo;

      if (swapInfo) {
        appEventBus.emit(EAppEventBusNames.SwapSpeedBuildTxSuccess, {
          fromToken,
          toToken,
          fromAmount: swapInfo.sender.amount,
          toAmount: swapInfo.receiver.amount,
        });

        const fromNetworkPreset = Object.values(presetNetworksMap).find(
          (item) => item.id === swapInfo.sender.token.networkId,
        );
        const toNetworkPreset = Object.values(presetNetworksMap).find(
          (item) => item.id === swapInfo.receiver.token.networkId,
        );
        if (
          swapInfo &&
          (swapInfo.protocol === EProtocolOfExchange.SWAP ||
            swapInfo.swapBuildResData.result.isWrapped)
        ) {
          const useOrderId = false;
          const swapHistoryItem: ISwapTxHistory = {
            status: ESwapTxHistoryStatus.PENDING,
            currency: settingsAtom.currencyInfo?.symbol,
            accountInfo: {
              sender: {
                accountId: swapInfo.sender.accountInfo?.accountId,
                networkId: swapInfo.sender.accountInfo?.networkId,
              },
              receiver: {
                accountId: swapInfo.receiver.accountInfo?.accountId,
                networkId: swapInfo.receiver.accountInfo?.networkId,
              },
            },
            baseInfo: {
              toAmount: swapInfo.receiver.amount,
              fromAmount: swapInfo.sender.amount,
              fromToken: swapInfo.sender.token,
              toToken: swapInfo.receiver.token,
              fromNetwork: {
                networkId: fromNetworkPreset?.id ?? '',
                name: fromNetworkPreset?.name ?? '',
                symbol: fromNetworkPreset?.symbol ?? '',
                logoURI: fromNetworkPreset?.logoURI ?? '',
                shortcode: fromNetworkPreset?.shortcode ?? '',
              },
              toNetwork: {
                networkId: toNetworkPreset?.id ?? '',
                name: toNetworkPreset?.name ?? '',
                symbol: toNetworkPreset?.symbol ?? '',
                logoURI: toNetworkPreset?.logoURI ?? '',
                shortcode: toNetworkPreset?.shortcode ?? '',
              },
            },
            txInfo: {
              txId,
              useOrderId,
              gasFeeFiatValue: totalFeeFiatValue,
              gasFeeInNative: totalFeeInNative,
              sender: swapInfo.accountAddress,
              receiver: swapInfo.receivingAddress,
            },
            date: {
              created: Date.now(),
              updated: Date.now(),
            },
            swapInfo: {
              instantRate: swapInfo.swapBuildResData.result?.instantRate ?? '0',
              provider: swapInfo.swapBuildResData.result?.info,
              socketBridgeScanUrl:
                swapInfo.swapBuildResData.socketBridgeScanUrl,
              oneKeyFee:
                swapInfo.swapBuildResData.result?.fee?.percentageFee ?? 0,
              protocolFee:
                swapInfo.swapBuildResData.result?.fee?.protocolFees ?? 0,
              otherFeeInfos:
                swapInfo.swapBuildResData.result?.fee?.otherFeeInfos ?? [],
              orderId: swapInfo.swapBuildResData.orderId,
              supportUrl: swapInfo.swapBuildResData.result?.supportUrl,
              orderSupportUrl:
                swapInfo.swapBuildResData.result?.orderSupportUrl,
              oneKeyFeeExtraInfo:
                swapInfo.swapBuildResData.result?.oneKeyFeeExtraInfo,
            },
            ctx: swapInfo.swapBuildResData.ctx,
          };
          await backgroundApiProxy.serviceSwap.addSwapHistoryItem(
            swapHistoryItem,
          );
          if (
            swapInfo.sender.token.networkId ===
            swapInfo.receiver.token.networkId
          ) {
            void backgroundApiProxy.serviceNotification.blockNotificationForTxId(
              {
                networkId: txNetworkId,
                tx: txId,
              },
            );
          }
        }
      }
    },
    [settingsAtom.currencyInfo?.symbol, fromToken, toToken],
  );

  const cancelSpeedSwapBuildTx = useCallback(() => {
    // todo cancel build tx
    setSpeedSwapBuildTxLoading(false);
  }, []);

  const isWrapped = useMemo(
    () => checkWrappedTokenPair({ fromToken, toToken }),
    [fromToken, toToken],
  );

  const buildSpeedSwapApprovesInfo = useCallback(
    (reviewQuote?: IFetchQuoteResult) => {
      const userAddress = netAccountRes.result?.addressDetail.address ?? '';
      const amount = reviewQuote?.fromAmount ?? actionFromTokenAmount;
      const allowanceResult =
        reviewQuote?.allowanceResult ??
        (shouldApprove && effectiveSpenderAddress
          ? {
              allowanceTarget: effectiveSpenderAddress,
              amount,
              ...(shouldResetApprove
                ? {
                    shouldResetApprove: true,
                  }
                : {}),
            }
          : undefined);

      if (!userAddress || !amount) {
        return [];
      }

      return buildMarketSwapApproveInfos({
        allowanceResult,
        amount,
        owner: userAddress,
        fromToken,
      });
    },
    [
      netAccountRes.result?.addressDetail.address,
      actionFromTokenAmount,
      shouldApprove,
      effectiveSpenderAddress,
      shouldResetApprove,
      fromToken,
    ],
  );

  const fetchSpeedSwapReviewQuote = useCallback(async () => {
    const userAddress = netAccountRes.result?.addressDetail.address ?? '';

    if (!userAddress || !actionFromTokenAmount) {
      return undefined;
    }

    if (isWrapped) {
      return createWrappedMarketSwapReviewQuote({
        fromToken,
        toToken,
        fromTokenAmount: actionFromTokenAmount,
        providerLogo: wrappedTokens.find(
          (item) => item.networkId === fromToken.networkId,
        )?.logo,
      });
    }

    const quoteResults =
      await backgroundApiProxy.serviceSwap.fetchSpeedSwapQuote({
        fromToken,
        toToken,
        fromTokenAmount: actionFromTokenAmount,
        userAddress,
        receivingAddress: userAddress,
        slippagePercentage: slippage,
        accountId: netAccountRes.result?.id ?? '',
        protocol: ESwapTabSwitchType.SWAP,
        kind: ESwapQuoteKind.SELL,
      });

    const matchedQuote =
      quoteResults.find((item) => item.info.provider === provider) ??
      quoteResults[0];

    if (!matchedQuote?.toAmount) {
      return undefined;
    }

    return {
      ...matchedQuote,
      fromAmount: matchedQuote.fromAmount ?? actionFromTokenAmount,
      fromTokenInfo: fromToken,
      toTokenInfo: toToken,
      allowanceResult:
        matchedQuote.allowanceResult ??
        (shouldApprove && effectiveSpenderAddress
          ? {
              allowanceTarget: effectiveSpenderAddress,
              amount: actionFromTokenAmount,
              ...(shouldResetApprove
                ? {
                    shouldResetApprove: true,
                  }
                : {}),
            }
          : undefined),
    };
  }, [
    netAccountRes.result?.addressDetail.address,
    netAccountRes.result?.id,
    actionFromTokenAmount,
    isWrapped,
    fromToken,
    toToken,
    slippage,
    provider,
    shouldApprove,
    effectiveSpenderAddress,
    shouldResetApprove,
  ]);

  const speedSwapBuildTx = useCallback(
    async (options?: ISpeedSwapSubmitOptions) => {
      const { onCancel, onSuccess, reviewQuote } = options ?? {};
      setSpeedSwapBuildTxLoading(true);
      const userAddress = netAccountRes.result?.addressDetail.address ?? '';
      const tradeAmount = reviewQuote?.fromAmount ?? actionFromTokenAmount;
      const tradeProvider = reviewQuote?.info.provider ?? provider;
      const buildParams = {
        fromToken,
        toToken,
        fromTokenAmount: tradeAmount,
        provider: tradeProvider,
        userAddress,
        receivingAddress: userAddress,
        slippagePercentage: slippage,
        accountId: netAccountRes.result?.id ?? '',
        protocol: EProtocolOfExchange.SWAP,
        kind: ESwapQuoteKind.SELL,
      };
      const buildRes =
        await backgroundApiProxy.serviceSwap.fetchBuildSpeedSwapTx(buildParams);
      if (!buildRes) {
        setSpeedSwapBuildTxLoading(false);
        return;
      }
      try {
        let transferInfo: ITransferInfo | undefined;
        let encodedTx: IEncodedTx | undefined;
        if (buildRes?.OKXTxObject) {
          encodedTx =
            await backgroundApiProxy.serviceSwap.buildOkxSwapEncodedTx({
              accountId: netAccountRes.result?.id ?? '',
              networkId: fromToken.networkId,
              okxTx: buildRes.OKXTxObject,
              fromTokenInfo: buildRes.result.fromTokenInfo,
              type: ESwapTabSwitchType.SWAP,
            });
        } else if (buildRes?.tx) {
          transferInfo = undefined;
          if (typeof buildRes.tx !== 'string' && buildRes.tx.data) {
            const valueHex = toBigIntHex(new BigNumber(buildRes.tx.value ?? 0));
            encodedTx = {
              ...buildRes?.tx,
              value: valueHex,
              from: userAddress,
            };
          } else {
            encodedTx = buildRes.tx as string;
          }
        }
        const swapInfo: ISwapTxInfo = {
          protocol: EProtocolOfExchange.SWAP,
          sender: {
            amount: tradeAmount,
            token: fromToken,
            accountInfo: {
              accountId: netAccountRes.result?.id ?? '',
              networkId: fromToken.networkId,
            },
          },
          receiver: {
            amount: buildRes?.result.toAmount ?? '',
            token: toToken,
            accountInfo: {
              accountId: netAccountRes.result?.id ?? '',
              networkId: toToken.networkId,
            },
          },
          accountAddress: userAddress,
          receivingAddress: userAddress,
          swapBuildResData: {
            ...buildRes,
            result: {
              ...buildRes?.result,
              slippage: buildRes?.result?.slippage ?? slippage,
            },
          },
        };
        await navigationToTxConfirm({
          isInternalSwap: true,
          transfersInfo: transferInfo ? [transferInfo] : undefined,
          encodedTx,
          swapInfo,
          approvesInfo: buildSpeedSwapApprovesInfo(reviewQuote),
          onSuccess: async (data) => {
            await handleSpeedSwapBuildTxSuccess(data);
            onSuccess?.();
          },
          onCancel: () => {
            cancelSpeedSwapBuildTx();
            onCancel?.();
          },
          disableMev: !antiMEV,
        });

        defaultLogger.swap.createSwapOrder.swapCreateOrder({
          fromTokenAmount: tradeAmount,
          fromAddress: userAddress,
          toAddress: userAddress,
          toTokenAmount: buildRes.result?.toAmount ?? '',
          status: ESwapEventAPIStatus.SUCCESS,
          swapProvider: buildRes.result?.info.provider ?? '',
          swapProviderName: buildRes.result?.info.providerName ?? '',
          swapType: ESwapTabSwitchType.SWAP,
          slippage: slippage.toString(),
          sourceChain: fromToken.networkId ?? '',
          receivedChain: toToken.networkId ?? '',
          sourceTokenSymbol: fromToken.symbol ?? '',
          receivedTokenSymbol: toToken.symbol ?? '',
          feeType: buildRes.result?.fee?.percentageFee?.toString() ?? '0',
          router: JSON.stringify(buildRes.result?.routesData ?? ''),
          isFirstTime: isFirstTimeSwap,
          createFrom: 'marketDex',
        });

        return buildRes;
      } catch (_e) {
        setSpeedSwapBuildTxLoading(false);
        defaultLogger.swap.createSwapOrder.swapCreateOrder({
          fromTokenAmount: tradeAmount,
          fromAddress: userAddress,
          toAddress: userAddress,
          toTokenAmount: buildRes.result?.toAmount ?? '',
          status: ESwapEventAPIStatus.FAIL,
          swapProvider: buildRes.result?.info.provider ?? '',
          swapProviderName: buildRes.result?.info.providerName ?? '',
          swapType: ESwapTabSwitchType.SWAP,
          slippage: slippage.toString(),
          sourceChain: fromToken.networkId ?? '',
          receivedChain: toToken.networkId ?? '',
          sourceTokenSymbol: fromToken.symbol ?? '',
          receivedTokenSymbol: toToken.symbol ?? '',
          feeType: buildRes.result?.fee?.percentageFee?.toString() ?? '0',
          router: JSON.stringify(buildRes.result?.routesData ?? ''),
          isFirstTime: isFirstTimeSwap,
          createFrom: 'marketDex',
        });
      }
    },
    [
      netAccountRes.result?.addressDetail.address,
      netAccountRes.result?.id,
      actionFromTokenAmount,
      fromToken,
      toToken,
      provider,
      slippage,
      navigationToTxConfirm,
      buildSpeedSwapApprovesInfo,
      handleSpeedSwapBuildTxSuccess,
      cancelSpeedSwapBuildTx,
      antiMEV,
      isFirstTimeSwap,
    ],
  );

  const speedSwapWrappedTx = useCallback(
    async (options?: ISpeedSwapSubmitOptions) => {
      const { onCancel, onSuccess } = options ?? {};
      if (netAccountRes.result?.addressDetail.address) {
        const wrappedType = fromToken.isNative
          ? EWrappedType.DEPOSIT
          : EWrappedType.WITHDRAW;
        const wrappedInfo: IWrappedInfo = {
          from: netAccountRes.result?.addressDetail.address,
          type: wrappedType,
          contract:
            wrappedType === EWrappedType.WITHDRAW
              ? fromToken.contractAddress
              : toToken.contractAddress,
          amount: actionFromTokenAmount,
        };
        const swapInfo: ISwapTxInfo = {
          protocol: EProtocolOfExchange.SWAP,
          sender: {
            amount: actionFromTokenAmount,
            token: fromToken,
            accountInfo: {
              accountId: netAccountRes.result?.id ?? '',
              networkId: fromToken.networkId,
            },
          },
          receiver: {
            amount: actionFromTokenAmount,
            token: toToken,
            accountInfo: {
              accountId: netAccountRes.result?.id ?? '',
              networkId: toToken.networkId,
            },
          },
          accountAddress: netAccountRes.result?.addressDetail.address,
          receivingAddress: netAccountRes.result?.addressDetail.address,
          swapBuildResData: {
            orderId: stringUtils.generateUUID(),
            result: {
              info: {
                provider: 'wrapped',
                providerName: 'wrapped',
                providerLogo: wrappedTokens.find(
                  (item) => item.networkId === fromToken.networkId,
                )?.logo,
              },
              fromTokenInfo: fromToken,
              toTokenInfo: toToken,
              fromAmount: actionFromTokenAmount,
              toAmount: actionFromTokenAmount,
            },
          },
        };
        setSpeedSwapBuildTxLoading(true);
        await navigationToTxConfirm({
          isInternalSwap: true,
          wrappedInfo,
          swapInfo,
          onSuccess: async (data) => {
            await handleSpeedSwapBuildTxSuccess(data);
            onSuccess?.();
          },
          onCancel: () => {
            cancelSpeedSwapBuildTx();
            onCancel?.();
          },
          disableMev: !antiMEV,
        });
      }
    },
    [
      netAccountRes.result?.addressDetail.address,
      netAccountRes.result?.id,
      actionFromTokenAmount,
      fromToken,
      toToken,
      navigationToTxConfirm,
      handleSpeedSwapBuildTxSuccess,
      cancelSpeedSwapBuildTx,
      antiMEV,
    ],
  );

  const checkTokenApproveAllowance = useCallback(
    async (amount: string, overrideSpenderAddress?: string) => {
      const spender = overrideSpenderAddress || effectiveSpenderAddress;
      const amountBN = new BigNumber(amount || 0);
      try {
        if (
          !spender ||
          netAccountRes.result?.addressDetail.networkId !==
            fromToken.networkId ||
          !netAccountRes.result?.addressDetail.address ||
          amountBN.isZero() ||
          amountBN.isNaN() ||
          fromToken.isNative ||
          !fromToken.contractAddress ||
          isWrapped
        ) {
          setShouldApprove(false);
          setShouldResetApprove(false);
          return;
        }
        setCheckTokenAllowanceLoading(true);

        const userAddress = netAccountRes.result?.addressDetail.address ?? '';

        const fetchApproveAllowanceParams = {
          networkId: fromToken.networkId,
          tokenAddress: fromToken.contractAddress,
          spenderAddress: spender,
          walletAddress: userAddress,
          amount,
        };

        const approveRes =
          await backgroundApiProxy.serviceSwap.fetchApproveAllowance(
            fetchApproveAllowanceParams,
          );

        setShouldApprove(!approveRes.isApproved);
        setShouldResetApprove(!!approveRes.shouldResetApprove);
        setCheckTokenAllowanceLoading(false);
      } catch (e: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (e.cause !== ESwapFetchCancelCause.SWAP_APPROVE_ALLOWANCE_CANCEL) {
          setCheckTokenAllowanceLoading(false);
        }
      }
    },
    [
      fromToken.isNative,
      fromToken.contractAddress,
      fromToken.networkId,
      netAccountRes.result?.addressDetail.address,
      netAccountRes.result?.addressDetail.networkId,
      effectiveSpenderAddress,
      isWrapped,
    ],
  );

  const syncTokensBalance = useCallback(
    async ({
      orderFromToken,
      orderToToken,
    }: {
      orderFromToken?: ISwapTokenBase;
      orderToToken?: ISwapTokenBase;
    }) => {
      if (
        netAccountRes.result?.id &&
        netAccountRes.result?.addressDetail.address &&
        orderFromToken?.networkId ===
          netAccountRes.result?.addressDetail.networkId &&
        (equalTokenNoCaseSensitive({
          token1: orderFromToken,
          token2: {
            networkId: balanceToken?.networkId,
            contractAddress: balanceToken?.contractAddress,
          },
        }) ||
          equalTokenNoCaseSensitive({
            token1: orderToToken,
            token2: {
              networkId: balanceToken?.networkId,
              contractAddress: balanceToken?.contractAddress,
            },
          }))
      ) {
        if (!balanceToken?.networkId) return;
        setFetchBalanceLoading(true);
        try {
          const tokenDetail =
            await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
              networkId: balanceToken?.networkId ?? '',
              contractAddress: balanceToken?.contractAddress ?? '',
              accountId: netAccountRes.result?.id ?? '',
              accountAddress: netAccountRes.result?.addressDetail.address ?? '',
              currency: 'usd',
            });
          if (tokenDetail?.length) {
            setBalance(new BigNumber(tokenDetail[0].balanceParsed ?? 0));
          }
          setFetchBalanceLoading(false);
        } catch (_e) {
          setFetchBalanceLoading(false);
        }
      } else {
        setBalance(new BigNumber(0));
      }
    },
    [
      balanceToken?.networkId,
      balanceToken?.contractAddress,
      netAccountRes.result?.addressDetail.address,
      netAccountRes.result?.id,
      netAccountRes.result?.addressDetail.networkId,
    ],
  );

  const fetchTokenPrice = useCallback(async () => {
    setPriceRate((prev) => ({
      ...prev,
      loading: true,
    }));
    if (fromToken.price && toToken.price) {
      const fromTokenPriceBN = new BigNumber(fromToken.price || 0);
      const toTokenPriceBN = new BigNumber(toToken.price || 0);
      setPriceRate({
        rate: toTokenPriceBN.isZero()
          ? 0
          : fromTokenPriceBN.dividedBy(toTokenPriceBN).toNumber(),
        fromTokenSymbol: fromToken.symbol,
        toTokenSymbol: toToken.symbol,
        loading: false,
      });
    } else {
      if (!fromToken?.networkId || !toToken?.networkId) return;
      const [fromTokenPrice, toTokenPrice] = await Promise.all([
        backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
          networkId: fromToken.networkId ?? '',
          contractAddress: fromToken.contractAddress ?? '',
          currency: 'usd',
        }),
        backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
          networkId: toToken.networkId ?? '',
          contractAddress: toToken.contractAddress ?? '',
          currency: 'usd',
        }),
      ]);
      if (fromTokenPrice?.length && toTokenPrice?.length) {
        const fromTokenPriceBN = new BigNumber(fromTokenPrice[0].price || 0);
        const toTokenPriceBN = new BigNumber(toTokenPrice[0].price || 0);
        setPriceRate({
          rate: toTokenPriceBN.isZero()
            ? 0
            : fromTokenPriceBN.dividedBy(toTokenPriceBN).toNumber(),
          fromTokenSymbol: fromToken.symbol,
          toTokenSymbol: toToken.symbol,
          loading: false,
        });
      } else {
        setPriceRate((prev) => ({
          ...prev,
          loading: false,
        }));
      }
    }
  }, [
    fromToken.price,
    fromToken.symbol,
    fromToken.networkId,
    fromToken.contractAddress,
    toToken.price,
    toToken.symbol,
    toToken.networkId,
    toToken.contractAddress,
  ]);

  useEffect(() => {
    if (fromToken.networkId && toToken.networkId) {
      void fetchTokenPrice();
    }
  }, [
    fetchTokenPrice,
    fromToken.networkId,
    toToken.networkId,
    fromToken.contractAddress,
    toToken.contractAddress,
  ]);

  useEffect(() => {
    if (fromToken?.networkId && fromToken?.isNative) {
      void (async () => {
        const nativeTokenConfig =
          await backgroundApiProxy.serviceSwap.fetchSwapNativeTokenConfig({
            networkId: fromToken.networkId,
          });
        setSwapNativeTokenReserveGas((pre) => {
          const find = pre.find(
            (item) => item.networkId === fromToken.networkId,
          );
          if (find) {
            return [
              ...pre.filter((item) => item.networkId !== fromToken.networkId),
              {
                networkId: fromToken.networkId,
                reserveGas: nativeTokenConfig.reserveGas,
              },
            ];
          }
          return [...pre, nativeTokenConfig];
        });
      })();
    }
  }, [fromToken?.networkId, fromToken?.isNative, setSwapNativeTokenReserveGas]);

  useEffect(() => {
    appEventBus.off(
      EAppEventBusNames.SwapSpeedBalanceUpdate,
      syncTokensBalance,
    );
    appEventBus.on(EAppEventBusNames.SwapSpeedBalanceUpdate, syncTokensBalance);
    return () => {
      appEventBus.off(
        EAppEventBusNames.SwapSpeedBalanceUpdate,
        syncTokensBalance,
      );
    };
  }, [syncTokensBalance]);

  const runSpeedCheckAndAllowance = useCallback(
    async (amount: string) => {
      const amountBN = new BigNumber(amount || 0);
      if (amountBN.isNaN() || amountBN.lte(0)) {
        setSpeedCheckError('');
        setCheckSpenderAddress('');
        setShouldApprove(false);
        setShouldResetApprove(false);
        return;
      }

      speedCheckRequestIdRef.current += 1;
      const currentRequestId = speedCheckRequestIdRef.current;

      setSpeedCheckLoading(true);
      setSpeedCheckError('');
      try {
        const checkResult =
          await backgroundApiProxy.serviceSwap.fetchSpeedCheck({
            fromNetworkId: fromToken.networkId,
            toNetworkId: toToken.networkId,
            fromTokenAddress: fromToken.contractAddress,
            toTokenAddress: toToken.contractAddress,
            fromTokenAmount: amount,
            protocol: EProtocolOfExchange.SWAP,
          });

        // Discard stale response
        if (currentRequestId !== speedCheckRequestIdRef.current) {
          return;
        }

        if (checkResult?.errorMessage) {
          setSpeedCheckError(checkResult.errorMessage);
          setSpeedCheckLoading(false);
          setShouldApprove(false);
          setShouldResetApprove(false);
          return;
        }

        const newSpenderAddress = checkResult?.spenderAddress || '';
        setCheckSpenderAddress(newSpenderAddress);
        setSpeedCheckLoading(false);

        // Proceed with allowance check if non-native token
        if (
          !fromToken.isNative &&
          !isWrapped &&
          fromToken.contractAddress &&
          netAccountRes?.result?.addressDetail.address &&
          (newSpenderAddress || spenderAddress)
        ) {
          void checkTokenApproveAllowance(
            amount,
            newSpenderAddress || spenderAddress,
          );
        } else {
          setShouldApprove(false);
          setShouldResetApprove(false);
        }
      } catch (_e) {
        if (currentRequestId === speedCheckRequestIdRef.current) {
          setSpeedCheckLoading(false);
        }
      }
    },
    [
      fromToken.networkId,
      fromToken.contractAddress,
      fromToken.isNative,
      toToken.networkId,
      toToken.contractAddress,
      isWrapped,
      netAccountRes?.result?.addressDetail.address,
      spenderAddress,
      checkTokenApproveAllowance,
    ],
  );

  const runSpeedCheckAndAllowanceRef = useRef(runSpeedCheckAndAllowance);
  runSpeedCheckAndAllowanceRef.current = runSpeedCheckAndAllowance;

  useEffect(() => {
    const fromTokenAmountDebouncedBN = new BigNumber(
      fromTokenAmountDebounced || 0,
    );
    if (
      !fromTokenAmountDebouncedBN.isNaN() &&
      fromTokenAmountDebouncedBN.gt(0) &&
      netAccountRes?.result?.addressDetail.address &&
      balance?.gt(0)
    ) {
      void runSpeedCheckAndAllowanceRef.current(
        fromTokenAmountDebouncedBN.toFixed(),
      );
    } else {
      setSpeedCheckError('');
      setCheckSpenderAddress('');
      setShouldApprove(false);
      setShouldResetApprove(false);
    }
  }, [
    isWrapped,
    balance,
    fromToken.isNative,
    fromToken.networkId,
    fromToken.contractAddress,
    toToken.networkId,
    toToken.contractAddress,
    fromTokenAmountDebounced,
    netAccountRes?.result?.addressDetail.address,
  ]);

  useEffect(() => {
    void syncTokensBalance({
      orderFromToken: {
        networkId: balanceToken?.networkId,
        contractAddress: balanceToken?.contractAddress,
        symbol: balanceToken?.symbol,
        decimals: balanceToken?.decimals,
        logoURI: balanceToken?.logoURI,
        name: balanceToken?.name,
        isNative: balanceToken?.isNative,
      },
    });
  }, [
    balanceToken?.contractAddress,
    balanceToken?.decimals,
    balanceToken?.isNative,
    balanceToken?.logoURI,
    balanceToken?.name,
    balanceToken?.networkId,
    balanceToken?.symbol,
    netAccountRes.result?.addressDetail.address,
    syncTokensBalance,
  ]);

  return {
    speedSwapBuildTx,
    fetchSpeedSwapReviewQuote,
    speedSwapWrappedTx,
    speedSwapBuildTxLoading,
    checkTokenAllowanceLoading,
    balance,
    balanceToken,
    fetchBalanceLoading,
    swapNativeTokenReserveGas,
    priceRate,
    isWrapped,
    speedCheckError,
    speedCheckLoading,
  };
}
