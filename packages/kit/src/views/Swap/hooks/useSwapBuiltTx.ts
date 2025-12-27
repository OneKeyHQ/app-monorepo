import { useCallback, useMemo, useRef } from 'react';

import {
  OrderBalance,
  hashify,
  normalizeBuyTokenBalance,
  timestamp,
} from '@cowprotocol/contracts';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { cloneDeep, isEqual, isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Toast,
  rootNavigationRef,
  useIsOverlayPage,
} from '@onekeyhq/components';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
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
import {
  BATCH_APPROVE_GAS_FEE_RATIO_FOR_SWAP,
  BATCH_SEND_TXS_FEE_UP_RATIO_FOR_SWAP,
} from '@onekeyhq/shared/src/consts/walletConsts';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ESwapEventAPIStatus } from '@onekeyhq/shared/src/logger/scopes/swap/scenes/swapEstimateFee';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EScanQrCodeModalPages } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { calculateFeeForSend } from '@onekeyhq/shared/src/utils/feeUtils';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  numberFormat,
  toBigIntHex,
} from '@onekeyhq/shared/src/utils/numberUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type {
  IFeeAlgo,
  IFeeCkb,
  IFeeDot,
  IFeeInfoUnit,
  IFeeSol,
  IFeeSui,
  IFeeTron,
  IFeeUTXO,
  IGasEIP1559,
  IGasLegacy,
} from '@onekeyhq/shared/types/fee';
import {
  EMessageTypesEth,
  ESigningScheme,
} from '@onekeyhq/shared/types/message';
import { ESendPreCheckTimingEnum } from '@onekeyhq/shared/types/send';
import {
  EInternalDappEnum,
  type IStakeTx,
} from '@onekeyhq/shared/types/staking';
import type {
  ESwapCancelLimitOrderSource,
  IFetchBuildTxResponse,
  IFetchLimitOrderRes,
  IFetchQuoteResult,
  IOneInchOrderStruct,
  ISwapGasInfo,
  ISwapPreSwapData,
  ISwapStep,
  ISwapToken,
  ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapApproveTransactionStatus,
  ESwapDirectionType,
  ESwapNetworkFeeLevel,
  ESwapQuoteKind,
  ESwapStepStatus,
  ESwapStepType,
  ESwapTabSwitchType,
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
  useSwapProInputAmountAtom,
  useSwapQuoteEventTotalCountAtom,
  useSwapQuoteListAtom,
  useSwapStepNetFeeLevelAtom,
  useSwapStepsAtom,
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';

import { useSwapAddressInfo } from './useSwapAccount';
import { useSwapBuildTxInfo, useSwapProAccount } from './useSwapPro';
import {
  useSwapActionState,
  useSwapSlippagePercentageModeInfo,
} from './useSwapState';
import { useSwapTxHistoryActions } from './useSwapTxHistory';

const formatter: INumberFormatProps = {
  formatter: 'balance',
};
/**
 * React hook that manages the full lifecycle of building, approving, signing, and sending swap transactions in a multi-step workflow.
 *
 * Integrates with background APIs, handles UI state updates, fee checks, error handling, and event logging for swap operations. Supports various swap protocols, approval flows, limit order cancellation, and fallback UI confirmations. Returns functions to start the swap steps execution and to cancel limit orders.
 *
 * @returns An object with `preSwapStepsStart` to initiate the swap steps process and `cancelLimitOrder` to cancel a limit order.
 */
export function useSwapBuildTx() {
  const intl = useIntl();
  const {
    currentQuoteRes: selectQuote,
    fromSelectToken: fromToken,
    toSelectToken: toToken,
  } = useSwapBuildTxInfo();
  const { slippageItem } = useSwapSlippagePercentageModeInfo();
  const [, setSwapBuildTxFetching] = useSwapBuildTxFetchingAtom();
  const [, setInAppNotificationAtom] = useInAppNotificationAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const swapToAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  const swapProAccount = useSwapProAccount();
  const focusSwapPro = useMemo(() => {
    return platformEnv.isNative && swapTypeSwitch === ESwapTabSwitchType.LIMIT;
  }, [swapTypeSwitch]);
  const fromUserAddress = useMemo(() => {
    if (focusSwapPro) {
      return swapProAccount.result?.addressDetail.address;
    }
    return swapFromAddressInfo.address;
  }, [
    focusSwapPro,
    swapProAccount.result?.addressDetail.address,
    swapFromAddressInfo.address,
  ]);
  const toUserAddress = useMemo(() => {
    if (focusSwapPro) {
      return swapProAccount.result?.addressDetail.address;
    }
    return swapToAddressInfo.address;
  }, [
    focusSwapPro,
    swapProAccount.result?.addressDetail.address,
    swapToAddressInfo.address,
  ]);
  const fromAccountId = useMemo(() => {
    if (focusSwapPro) {
      return swapProAccount.result?.id;
    }
    return swapFromAddressInfo.accountInfo?.account?.id;
  }, [
    focusSwapPro,
    swapProAccount.result?.id,
    swapFromAddressInfo.accountInfo?.account?.id,
  ]);
  const toAccountId = useMemo(() => {
    if (focusSwapPro) {
      return swapProAccount.result?.id;
    }
    return swapToAddressInfo.accountInfo?.account?.id;
  }, [
    focusSwapPro,
    swapProAccount.result?.id,
    swapToAddressInfo.accountInfo?.account?.id,
  ]);
  const fromAccountIndexedAccountId = useMemo(() => {
    if (focusSwapPro) {
      return swapProAccount.result?.indexedAccountId;
    }
    return swapFromAddressInfo.accountInfo?.indexedAccount?.id;
  }, [
    focusSwapPro,
    swapProAccount.result?.indexedAccountId,
    swapFromAddressInfo.accountInfo?.indexedAccount?.id,
  ]);
  const fromAccountNetworkId = useMemo(() => {
    if (focusSwapPro) {
      return swapProAccount.result?.addressDetail.networkId;
    }
    return swapFromAddressInfo.networkId;
  }, [
    focusSwapPro,
    swapProAccount.result?.addressDetail.networkId,
    swapFromAddressInfo.networkId,
  ]);
  const dbAccountId = useMemo(() => {
    if (focusSwapPro) {
      return swapProAccount.result?.id;
    }
    return swapFromAddressInfo.accountInfo?.dbAccount?.id;
  }, [
    focusSwapPro,
    swapFromAddressInfo.accountInfo?.dbAccount?.id,
    swapProAccount.result?.id,
  ]);
  const { generateSwapHistoryItem } = useSwapTxHistoryActions();
  const [swapLimitExpirationTime] = useSwapLimitExpirationTimeAtom();
  const [swapLimitPriceFromAmount] = useSwapLimitPriceFromAmountAtom();
  const [swapLimitPriceToAmount] = useSwapLimitPriceToAmountAtom();
  const [swapLimitPartiallyFillObj] = useSwapLimitPartiallyFillAtom();
  const [swapSteps, setSwapSteps] = useSwapStepsAtom();
  const [{ isFirstTimeSwap }, setPersistSettings] = useSettingsPersistAtom();
  const swapActionState = useSwapActionState();
  const [swapNetWorkFeeLevel] = useSwapStepNetFeeLevelAtom();
  const [, setSwapFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [, setSwapToTokenAmount] = useSwapToTokenAmountAtom();
  const [, setSwapQuoteResultList] = useSwapQuoteListAtom();
  const [, setSwapProFromAmount] = useSwapProInputAmountAtom();
  const [, setSwapQuoteEventTotalCount] = useSwapQuoteEventTotalCountAtom();
  const [, setSettings] = useSettingsAtom();
  const { navigationToMessageConfirm, navigationToTxConfirm } =
    useSignatureConfirm({
      accountId: fromAccountId ?? '',
      networkId: fromAccountNetworkId ?? '',
    });

  const swapStepsRef = useRef(swapSteps);
  if (swapStepsRef.current !== swapSteps) {
    swapStepsRef.current = swapSteps;
  }

  const isModalPage = useIsOverlayPage();

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
    setSwapProFromAmount('');
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
    setSwapProFromAmount,
  ]);

  const goBackQrCodeModal = useCallback(() => {
    if (
      rootNavigationRef.current?.canGoBack() &&
      rootNavigationRef.current?.getCurrentRoute()?.name ===
        EScanQrCodeModalPages.ScanQrCodeStack
    ) {
      rootNavigationRef.current?.goBack();
    }
  }, []);

  const onBuildTxSuccess = useCallback(
    async (
      txId: string,
      swapInfo: ISwapTxInfo,
      orderId?: string,
      gasFeeFiatValue?: string,
      gasFeeInNative?: string,
    ) => {
      if (swapInfo) {
        clearQuoteData();
        setSwapSteps(
          (prevSteps: {
            steps: ISwapStep[];
            preSwapData: ISwapPreSwapData;
            quoteResult?: IFetchQuoteResult | undefined;
          }) => {
            const newSteps = [...prevSteps.steps];
            newSteps[newSteps.length - 1] = {
              ...newSteps[newSteps.length - 1],
              status: ESwapStepStatus.PENDING,
              txHash: txId,
              orderId,
            };
            return {
              ...prevSteps,
              steps: newSteps,
            };
          },
        );
        if (
          accountUtils.isQrAccount({
            accountId: fromAccountId ?? '',
          })
        ) {
          void goBackQrCodeModal();
        }
        await generateSwapHistoryItem({
          txId,
          swapTxInfo: swapInfo,
          gasFeeFiatValue,
          gasFeeInNative,
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
    [
      clearQuoteData,
      goBackQrCodeModal,
      generateSwapHistoryItem,
      setSwapSteps,
      fromAccountId,
    ],
  );

  const handleBuildTxSuccessWithSignedNoSend = useCallback(
    async ({
      swapInfo,
      orderId,
    }: {
      orderId?: string;
      swapInfo: ISwapTxInfo;
    }) => {
      if (swapInfo) {
        clearQuoteData();
        if (
          accountUtils.isQrAccount({
            accountId: fromAccountId ?? '',
          })
        ) {
          rootNavigationRef.current?.goBack();
        }
        setSwapSteps(
          (prevSteps: {
            steps: ISwapStep[];
            preSwapData: ISwapPreSwapData;
            quoteResult?: IFetchQuoteResult | undefined;
          }) => {
            const newSteps = [...prevSteps.steps];
            newSteps[newSteps.length - 1] = {
              ...newSteps[newSteps.length - 1],
              status: ESwapStepStatus.PENDING,
              orderId,
            };
            return {
              ...prevSteps,
              steps: newSteps,
            };
          },
        );
        await generateSwapHistoryItem({
          swapTxInfo: swapInfo,
        });
      }
    },
    [clearQuoteData, generateSwapHistoryItem, setSwapSteps, fromAccountId],
  );

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
                accountAddress: fromUserAddress,
                accountId: fromAccountId,
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
                      number: numberFormat(tokenAmountBN.toFixed(), formatter),
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
    [fromToken, intl, selectQuote?.fromAmount, fromUserAddress, fromAccountId],
  );

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
        if (!fromAccountIndexedAccountId && !fromAccountId) {
          throw new OneKeyError('No account found');
        }
        let orderAccount: INetworkAccount | undefined;
        try {
          const defaultDeriveType =
            await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
              {
                networkId: item.networkId,
              },
            );
          orderAccount =
            await backgroundApiProxy.serviceAccount.getNetworkAccount({
              accountId: fromAccountIndexedAccountId
                ? undefined
                : fromAccountId,
              indexedAccountId: fromAccountIndexedAccountId ?? '',
              networkId: item.networkId,
              deriveType: defaultDeriveType ?? 'default',
            });
        } catch (e) {
          orderAccount = undefined;
        }
        if (dataMessage) {
          const signHash = await new Promise<string>((resolve, reject) => {
            if (dataMessage && item.userAddress && orderAccount) {
              navigationToMessageConfirm({
                accountId: orderAccount.id,
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
                    orderAccount?.addressDetail.address ?? ''
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
              fromAccountIndexedAccountId,
              !fromAccountIndexedAccountId
                ? fromAccountId ?? dbAccountId
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
    [
      fromAccountIndexedAccountId,
      fromAccountId,
      navigationToMessageConfirm,
      dbAccountId,
    ],
  );

  const updateUnsignedTxAndSendTx = useCallback(
    async ({
      stepIndex,
      networkId,
      accountId,
      unsignedTxItem,
      gasInfo,
    }: {
      stepIndex: number;
      networkId: string;
      accountId: string;
      unsignedTxItem: IUnsignedTxPro;
      gasInfo: ISwapGasInfo;
    }) => {
      if (!gasInfo.common) {
        throw new OneKeyError('gasInfo.common is required');
      }
      const updatedUnsignedTxItem =
        await backgroundApiProxy.serviceSend.updateUnsignedTx({
          networkId,
          accountId,
          unsignedTx: unsignedTxItem,
          feeInfo: {
            common: {
              baseFee: gasInfo.common?.baseFee,
              feeDecimals: gasInfo.common?.feeDecimals,
              feeSymbol: gasInfo.common?.feeSymbol,
              nativeDecimals: gasInfo.common?.nativeDecimals,
              nativeSymbol: gasInfo.common?.nativeSymbol,
              nativeTokenPrice: gasInfo.common?.nativeTokenPrice,
            },
            gas: gasInfo.gas,
            gasEIP1559: gasInfo.gasEIP1559,
            feeUTXO: gasInfo.feeUTXO,
            feeTron: gasInfo.feeTron,
            feeSol: gasInfo.feeSol,
            feeCkb: gasInfo.feeCkb,
            feeAlgo: gasInfo.feeAlgo,
            feeDot: gasInfo.feeDot,
            feeBudget: gasInfo.feeBudget,
          },
        });
      await backgroundApiProxy.serviceSend.precheckUnsignedTxs({
        networkId,
        accountId,
        unsignedTxs: [updatedUnsignedTxItem],
        precheckTiming: ESendPreCheckTimingEnum.Confirm,
      });
      setSwapSteps(
        (prev: {
          steps: ISwapStep[];
          preSwapData: ISwapPreSwapData;
          quoteResult?: IFetchQuoteResult | undefined;
        }) => {
          const newSteps = cloneDeep(prev.steps);
          newSteps[stepIndex] = {
            ...newSteps[stepIndex],
            stepSubTitle: intl.formatMessage({
              id: ETranslations.swap_process_sign_and_sent_tx,
            }),
          };
          return {
            ...prev,
            steps: newSteps,
          };
        },
      );
      const { totalNative } = calculateFeeForSend({
        feeInfo: gasInfo as IFeeInfoUnit,
        nativeTokenPrice: gasInfo.common?.nativeTokenPrice ?? 0,
      });
      await backgroundApiProxy.serviceTransaction.verifyTransaction({
        networkId,
        accountId,
        verifyTxTasks: ['feeInfo'],
        verifyTxFeeInfoParams: {
          feeAmount: totalNative,
          feeTokenSymbol: gasInfo.common?.nativeSymbol ?? '',
          doubleConfirm: true,
        },
        encodedTx: updatedUnsignedTxItem.encodedTx,
      });
      const res = await backgroundApiProxy.serviceSend.signAndSendTransaction({
        networkId,
        accountId,
        unsignedTx: updatedUnsignedTxItem,
        signOnly: false,
      });
      return res;
    },
    [intl, setSwapSteps],
  );

  const swapEstimateFeeEvent = useCallback(
    (
      status: ESwapEventAPIStatus,
      networkId: string,
      accountId: string,
      message?: string,
      encodedTx?: string,
      swapInfo?: ISwapTxInfo,
      isBatch?: boolean,
    ) => {
      let swapType = ESwapTabSwitchType.SWAP;
      if (swapInfo?.protocol === EProtocolOfExchange.LIMIT) {
        swapType = ESwapTabSwitchType.LIMIT;
      } else if (
        swapInfo?.sender.token.networkId !== swapInfo?.receiver.token.networkId
      ) {
        swapType = ESwapTabSwitchType.BRIDGE;
      }
      defaultLogger.swap.swapEstimateFee.swapEstimateFee({
        status,
        message,
        orderId: swapInfo?.swapBuildResData.orderId ?? '',
        swapType,
        slippage: slippageItem.value.toString(),
        router: JSON.stringify(
          swapInfo?.swapBuildResData.result.routesData ?? [],
        ),
        fromNetworkId: swapInfo?.sender.token.networkId ?? '',
        toNetworkId: swapInfo?.receiver.token.networkId ?? '',
        fromTokenSymbol: swapInfo?.sender.token.symbol ?? '',
        toTokenSymbol: swapInfo?.receiver.token.symbol ?? '',
        fromTokenAmount: swapInfo?.sender.amount ?? '',
        toTokenAmount: swapInfo?.receiver.amount ?? '',
        provider: swapInfo?.swapBuildResData.result.info.provider ?? '',
        providerName: swapInfo?.swapBuildResData.result.info.providerName ?? '',
        networkId,
        accountId,
        encodedTx: encodedTx ?? '',
        isBatch,
      });
    },
    [slippageItem.value],
  );

  const swapSendTxEvent = useCallback(
    (
      status: ESwapEventAPIStatus,
      networkId: string,
      accountId: string,
      message?: string,
      encodedTx?: string,
      swapInfo?: ISwapTxInfo,
      quoteResult?: IFetchQuoteResult,
    ) => {
      let swapType = ESwapTabSwitchType.SWAP;
      if (swapInfo?.protocol === EProtocolOfExchange.LIMIT) {
        swapType = ESwapTabSwitchType.LIMIT;
      } else if (
        swapInfo?.sender.token.networkId !== swapInfo?.receiver.token.networkId
      ) {
        swapType = ESwapTabSwitchType.BRIDGE;
      }
      defaultLogger.swap.swapSendTx.swapSendTx({
        fromAddress: fromUserAddress ?? '',
        toAddress: toUserAddress ?? '',
        status,
        message,
        orderId: swapInfo?.swapBuildResData.orderId ?? '',
        swapType,
        slippage: slippageItem.value.toString(),
        fromNetworkId: swapInfo?.sender.token.networkId ?? '',
        toNetworkId: swapInfo?.receiver.token.networkId ?? '',
        fromTokenSymbol: swapInfo?.sender.token.symbol ?? '',
        toTokenSymbol: swapInfo?.receiver.token.symbol ?? '',
        fromTokenAmount: swapInfo?.sender.amount ?? '',
        toTokenAmount: swapInfo?.receiver.amount ?? '',
        quoteToTokenAmount: quoteResult?.toAmount ?? '',
        router: JSON.stringify(
          swapInfo?.swapBuildResData.result.routesData ?? [],
        ),
        provider: swapInfo?.swapBuildResData.result.info.provider ?? '',
        providerName: swapInfo?.swapBuildResData.result.info.providerName ?? '',
        networkId,
        accountId,
        encodedTx: encodedTx ?? '',
      });
    },
    [slippageItem.value, fromUserAddress, toUserAddress],
  );

  const handleApproveFallbackOnSuccess = useCallback(
    (
      stepIndex: number,
      res?: ISendTxOnSuccessData[],
      shouldWaitApprove?: boolean,
    ) => {
      if (res?.[0]) {
        const transactionSignedInfo = res[0].signedTx;
        const approveInfo = res[0].approveInfo;
        const txId = transactionSignedInfo.txid;
        setInAppNotificationAtom((prev) => {
          if (prev.swapApprovingTransaction) {
            return {
              ...prev,
              swapApprovingTransaction: {
                ...prev.swapApprovingTransaction,
                txId,
                status: shouldWaitApprove
                  ? prev.swapApprovingTransaction.status
                  : ESwapApproveTransactionStatus.SUCCESS,
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
        if (!shouldWaitApprove) {
          setSwapSteps(
            (prev: {
              steps: ISwapStep[];
              preSwapData: ISwapPreSwapData;
              quoteResult?: IFetchQuoteResult | undefined;
            }) => {
              const newSteps = cloneDeep(prev.steps);
              newSteps[stepIndex] = {
                ...newSteps[stepIndex],
                status: ESwapStepStatus.SUCCESS,
              };
              return {
                ...prev,
                steps: newSteps,
              };
            },
          );
        }
      }
    },
    [setInAppNotificationAtom, setSwapSteps],
  );
  const handleApproveFallbackOnCancel = useCallback(
    (stepIndex: number) => {
      setSwapSteps(
        (prevSteps: {
          steps: ISwapStep[];
          preSwapData: ISwapPreSwapData;
          quoteResult?: IFetchQuoteResult | undefined;
        }) => {
          const newSteps = [...prevSteps.steps];
          newSteps[stepIndex] = {
            ...newSteps[stepIndex],
            status: ESwapStepStatus.FAILED,
          };
          return {
            ...prevSteps,
            steps: newSteps,
          };
        },
      );
    },
    [setSwapSteps],
  );

  const handleBuildTxFallbackOnSuccess = useCallback(
    async (res?: ISendTxOnSuccessData[], orderId?: string) => {
      if (res?.[0]) {
        const transactionSignedInfo = res[0].signedTx;
        const txId = transactionSignedInfo.txid;
        const { swapInfo } = transactionSignedInfo;
        const transactionDecodedInfo = res[0].decodedTx;
        const { totalFeeInNative, totalFeeFiatValue } = transactionDecodedInfo;
        if (swapInfo) {
          void onBuildTxSuccess(
            txId,
            swapInfo,
            orderId,
            totalFeeFiatValue,
            totalFeeInNative,
          );
        }
      }
    },
    [onBuildTxSuccess],
  );

  const handleBuildTxFallbackOnCancel = useCallback(
    async (stepIndex: number) => {
      setSwapSteps(
        (prev: {
          steps: ISwapStep[];
          preSwapData: ISwapPreSwapData;
          quoteResult?: IFetchQuoteResult | undefined;
        }) => {
          const newSteps = cloneDeep(prev.steps);
          newSteps[stepIndex] = {
            ...newSteps[stepIndex],
            status: ESwapStepStatus.FAILED,
          };
          return {
            ...prev,
            steps: newSteps,
          };
        },
      );
    },
    [setSwapSteps],
  );

  const updateStepTitle = useCallback(
    (stepIndex: number, i: number, approveUnsignedTxArr?: IUnsignedTxPro[]) => {
      if (swapStepsRef.current?.preSwapData?.isHWAndExBatchTransfer) {
        setSwapSteps(
          (prev: {
            steps: ISwapStep[];
            preSwapData: ISwapPreSwapData;
            quoteResult?: IFetchQuoteResult | undefined;
          }) => {
            const newSteps = cloneDeep(prev.steps);
            newSteps[stepIndex] = {
              ...newSteps[stepIndex],
              stepTitle: `${intl.formatMessage({
                id: ETranslations.swap_page_approve_and_swap,
              })} [ ${i + 1} / ${(approveUnsignedTxArr?.length ?? 0) + 1} ]`,
            };
            return {
              ...prev,
              steps: newSteps,
            };
          },
        );
      }
    },
    [intl, setSwapSteps],
  );

  const onApproveTxSuccess = useCallback(() => {
    if (
      accountUtils.isQrAccount({
        accountId: fromAccountId ?? '',
      })
    ) {
      goBackQrCodeModal();
    }
  }, [goBackQrCodeModal, fromAccountId]);

  const findGasInfo = useCallback(
    (
      stepGasInfos: { encodeTx: IEncodedTx; gasInfo: ISwapGasInfo }[],
      encodedTx: IEncodedTx,
    ) => {
      return stepGasInfos?.find(
        (s) =>
          isEqual(s.encodeTx, encodedTx) ||
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          ((s.encodeTx as any)?.rawSignTx &&
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            (encodedTx as any)?.rawSignTx &&
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            (s.encodeTx as any)?.rawSignTx ===
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              (encodedTx as any)?.rawSignTx),
      );
    },
    [],
  );

  const buildGasInfo = useCallback(
    (
      gasRes: {
        gas?: IGasLegacy[];
        gasEIP1559?: IGasEIP1559[];
        feeUTXO?: IFeeUTXO[];
        feeTron?: IFeeTron[];
        feeSol?: IFeeSol[];
        feeCkb?: IFeeCkb[];
        feeAlgo?: IFeeAlgo[];
        feeDot?: IFeeDot[];
        feeBudget?: IFeeSui[];
      },
      gasCommon: {
        baseFee?: string;
        feeDecimals: number;
        feeSymbol: string;
        nativeDecimals: number;
        nativeSymbol: string;
        nativeTokenPrice?: number;
      },
    ) => {
      let gasLet = gasRes.gas?.[1] ?? gasRes.gas?.[0];
      let gasEIP1559Let = gasRes.gasEIP1559?.[1] ?? gasRes.gasEIP1559?.[0];
      let feeUTXOLet = gasRes.feeUTXO?.[1] ?? gasRes.feeUTXO?.[0];
      let feeTronLet = gasRes.feeTron?.[1] ?? gasRes.feeTron?.[0];
      let feeSolLet = gasRes.feeSol?.[1] ?? gasRes.feeSol?.[0];
      let feeCkbLet = gasRes.feeCkb?.[1] ?? gasRes.feeCkb?.[0];
      let feeAlgoLet = gasRes.feeAlgo?.[1] ?? gasRes.feeAlgo?.[0];
      let feeDotLet = gasRes.feeDot?.[1] ?? gasRes.feeDot?.[0];
      let feeBudgetLet = gasRes.feeBudget?.[1] ?? gasRes.feeBudget?.[0];
      if (
        swapNetWorkFeeLevel?.networkFeeLevel &&
        swapNetWorkFeeLevel.networkFeeLevel === ESwapNetworkFeeLevel.LOW
      ) {
        gasLet = gasRes.gas?.[0];
        gasEIP1559Let = gasRes.gasEIP1559?.[0];
        feeUTXOLet = gasRes.feeUTXO?.[0];
        feeTronLet = gasRes.feeTron?.[0];
        feeSolLet = gasRes.feeSol?.[0];
        feeCkbLet = gasRes.feeCkb?.[0];
        feeAlgoLet = gasRes.feeAlgo?.[0];
        feeDotLet = gasRes.feeDot?.[0];
        feeBudgetLet = gasRes.feeBudget?.[0];
      }
      if (
        swapNetWorkFeeLevel?.networkFeeLevel &&
        swapNetWorkFeeLevel.networkFeeLevel === ESwapNetworkFeeLevel.HIGH
      ) {
        gasLet = gasRes.gas?.[2] ?? gasRes.gas?.[1] ?? gasRes.gas?.[0];
        gasEIP1559Let =
          gasRes.gasEIP1559?.[2] ??
          gasRes.gasEIP1559?.[1] ??
          gasRes.gasEIP1559?.[0];
        feeUTXOLet = gasRes.feeUTXO?.[0];
        feeTronLet = gasRes.feeTron?.[0];
        feeSolLet = gasRes.feeSol?.[0];
        feeCkbLet = gasRes.feeCkb?.[0];
        feeAlgoLet = gasRes.feeAlgo?.[0];
        feeDotLet = gasRes.feeDot?.[0];
        feeBudgetLet = gasRes.feeBudget?.[0];
      }

      const gasInfo = {
        common: gasCommon,
        gas: gasLet,
        gasEIP1559: gasEIP1559Let,
        feeUTXO: feeUTXOLet,
        feeTron: feeTronLet,
        feeSol: feeSolLet,
        feeCkb: feeCkbLet,
        feeAlgo: feeAlgoLet,
        feeDot: feeDotLet,
        feeBudget: feeBudgetLet,
      };
      return gasInfo;
    },
    [swapNetWorkFeeLevel?.networkFeeLevel],
  );

  const sendTxActions = useCallback(
    async (
      isApprove: boolean,
      stepIndex: number,
      networkId: string,
      accountId: string,
      buildUnsignedParams: ISendTxBaseParams & IBuildUnsignedTxParams,
      approveUnsignedTxArr?: IUnsignedTxPro[],
      quoteResult?: IFetchQuoteResult,
      needFetchGas?: boolean,
    ) => {
      if (!fromToken || !fromAccountId || !fromUserAddress) {
        throw new OneKeyError('account error');
      }
      const stepGasInfos =
        swapStepsRef.current.preSwapData.netWorkFee?.gasInfos;
      const swapInfo = buildUnsignedParams?.swapInfo;
      const buildUnsignedParamsCheckNonce = { ...buildUnsignedParams };
      if (approveUnsignedTxArr?.length && approveUnsignedTxArr.length > 0) {
        buildUnsignedParamsCheckNonce.prevNonce =
          approveUnsignedTxArr[approveUnsignedTxArr.length - 1].nonce;
      }
      setSwapSteps(
        (prev: {
          steps: ISwapStep[];
          preSwapData: ISwapPreSwapData;
          quoteResult?: IFetchQuoteResult | undefined;
        }) => {
          const newSteps = cloneDeep(prev.steps);
          newSteps[stepIndex] = {
            ...newSteps[stepIndex],
            stepSubTitle: intl.formatMessage({
              id: ETranslations.swap_process_build_and_estimate_tx,
            }),
          };
          return {
            ...prev,
            steps: newSteps,
          };
        },
      );
      let lastTxRes: ISignedTxPro | undefined;
      const unsignedTx =
        await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
          ...buildUnsignedParamsCheckNonce,
          isInternalSwap: true,
        });
      const vaultSettings =
        await backgroundApiProxy.serviceNetwork.getVaultSettings({
          networkId,
        });
      if (
        approveUnsignedTxArr?.length &&
        approveUnsignedTxArr.length > 0 &&
        vaultSettings.supportBatchEstimateFee?.[networkId]
      ) {
        const unsignedTxArr = [...approveUnsignedTxArr, unsignedTx];
        if (
          unsignedTxArr.every((tx) =>
            findGasInfo(stepGasInfos ?? [], tx.encodedTx),
          ) &&
          !needFetchGas
        ) {
          for (let i = 0; i < unsignedTxArr.length; i += 1) {
            const unsignedTxItem = unsignedTxArr[i];
            const gasInfoFinal = findGasInfo(
              stepGasInfos ?? [],
              unsignedTxItem.encodedTx,
            )?.gasInfo;
            if (gasInfoFinal) {
              try {
                updateStepTitle(stepIndex, i, approveUnsignedTxArr);
                const res = await updateUnsignedTxAndSendTx({
                  stepIndex,
                  networkId,
                  accountId,
                  unsignedTxItem,
                  gasInfo: gasInfoFinal,
                });
                if (i === unsignedTxArr.length - 1) {
                  lastTxRes = res;
                } else {
                  void onApproveTxSuccess();
                }
                if (!isApprove && i === unsignedTxArr.length - 1) {
                  void swapSendTxEvent(
                    ESwapEventAPIStatus.SUCCESS,
                    networkId,
                    accountId,
                    undefined,
                    JSON.stringify(unsignedTxItem.encodedTx ?? ''),
                    swapInfo,
                    quoteResult,
                  );
                }
              } catch (e: any) {
                if (!isApprove && i === unsignedTxArr.length - 1) {
                  void swapSendTxEvent(
                    ESwapEventAPIStatus.FAIL,
                    networkId,
                    accountId,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    e?.message ?? 'unknown error',
                    JSON.stringify(unsignedTxItem.encodedTx ?? ''),
                    swapInfo,
                    quoteResult,
                  );
                }
                throw e;
              }
            }
          }
        } else {
          const estimateFeeParamsArr = await Promise.all(
            unsignedTxArr.map((o) =>
              backgroundApiProxy.serviceGas.buildEstimateFeeParams({
                networkId,
                accountId,
                encodedTx: o.encodedTx,
              }),
            ),
          );
          try {
            const gasResArr =
              await backgroundApiProxy.serviceGas.batchEstimateFee({
                networkId,
                accountId,
                encodedTxs: estimateFeeParamsArr.map((o) => o.encodedTx ?? {}),
              });
            if (!isApprove) {
              void swapEstimateFeeEvent(
                ESwapEventAPIStatus.SUCCESS,
                networkId,
                accountId,
                undefined,
                JSON.stringify(
                  estimateFeeParamsArr.map((o) => o.encodedTx ?? {}) ?? '',
                ),
                swapInfo,
                true,
              );
            }
            for (let i = 0; i < unsignedTxArr.length; i += 1) {
              const unsignedTxItem = unsignedTxArr[i];
              const gasRes = gasResArr.txFees[i];
              const gasInfo = buildGasInfo(gasRes, gasResArr.common);
              try {
                updateStepTitle(stepIndex, i, approveUnsignedTxArr);
                const res = await updateUnsignedTxAndSendTx({
                  stepIndex,
                  networkId,
                  accountId,
                  unsignedTxItem,
                  gasInfo,
                });
                if (i === unsignedTxArr.length - 1) {
                  lastTxRes = res;
                } else {
                  void onApproveTxSuccess();
                }
                if (!isApprove && i === unsignedTxArr.length - 1) {
                  void swapSendTxEvent(
                    ESwapEventAPIStatus.SUCCESS,
                    networkId,
                    accountId,
                    undefined,
                    JSON.stringify(unsignedTxItem.encodedTx ?? ''),
                    swapInfo,
                    quoteResult,
                  );
                }
              } catch (e: any) {
                if (!isApprove && i === unsignedTxArr.length - 1) {
                  void swapSendTxEvent(
                    ESwapEventAPIStatus.FAIL,
                    networkId,
                    accountId,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    e?.message ?? 'unknown error',
                    JSON.stringify(unsignedTxItem.encodedTx ?? ''),
                    swapInfo,
                    quoteResult,
                  );
                }
                throw e;
              }
            }
          } catch (e: any) {
            if (!isApprove) {
              void swapEstimateFeeEvent(
                ESwapEventAPIStatus.FAIL,
                networkId,
                accountId,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                e?.message ?? 'unknown error',
                JSON.stringify(
                  estimateFeeParamsArr.map((o) => o.encodedTx ?? {}) ?? '',
                ),
                swapInfo,
                true,
              );
            }
            throw e;
          }
        }
      } else if (
        approveUnsignedTxArr?.length &&
        approveUnsignedTxArr.length > 0
      ) {
        const unsignedTxArr = [...approveUnsignedTxArr, unsignedTx];
        if (
          unsignedTxArr.every((tx) =>
            findGasInfo(stepGasInfos ?? [], tx.encodedTx),
          ) &&
          !needFetchGas
        ) {
          for (let i = 0; i < unsignedTxArr.length; i += 1) {
            const unsignedTxItem = unsignedTxArr[i];
            const gasInfoFinal = findGasInfo(
              stepGasInfos ?? [],
              unsignedTxItem.encodedTx,
            )?.gasInfo;
            if (gasInfoFinal) {
              try {
                updateStepTitle(stepIndex, i, approveUnsignedTxArr);
                const res = await updateUnsignedTxAndSendTx({
                  stepIndex,
                  networkId,
                  accountId,
                  unsignedTxItem,
                  gasInfo: gasInfoFinal,
                });
                if (i === unsignedTxArr.length - 1) {
                  lastTxRes = res;
                } else {
                  void onApproveTxSuccess();
                }
                if (!isApprove && i === unsignedTxArr.length - 1) {
                  void swapSendTxEvent(
                    ESwapEventAPIStatus.SUCCESS,
                    networkId,
                    accountId,
                    undefined,
                    JSON.stringify(unsignedTxItem.encodedTx ?? ''),
                    swapInfo,
                    quoteResult,
                  );
                }
              } catch (e: any) {
                if (!isApprove && i === unsignedTxArr.length - 1) {
                  void swapSendTxEvent(
                    ESwapEventAPIStatus.FAIL,
                    networkId,
                    accountId,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    e?.message ?? 'unknown error',
                    JSON.stringify(unsignedTxItem.encodedTx ?? ''),
                    swapInfo,
                    quoteResult,
                  );
                }
                throw e;
              }
            }
          }
        } else {
          let lastTxUseGasInfo: IFeeInfoUnit | undefined;
          for (let i = 0; i < unsignedTxArr.length; i += 1) {
            const unsignedTxItem = unsignedTxArr[i];
            if (i === unsignedTxArr.length - 1) {
              let specialGasLimit: string | undefined;
              const unsignedTxSwapInfo = unsignedTxItem.swapInfo;
              const internalSwapGasLimit =
                unsignedTxSwapInfo?.swapBuildResData.result.gasLimit;
              const internalSwapRoutes =
                unsignedTxSwapInfo?.swapBuildResData.result.routesData;
              const baseGasLimit =
                lastTxUseGasInfo?.gas?.gasLimit ??
                lastTxUseGasInfo?.gasEIP1559?.gasLimit;
              if (!isNil(internalSwapGasLimit)) {
                specialGasLimit = new BigNumber(internalSwapGasLimit).toFixed();
              } else if (internalSwapRoutes && internalSwapRoutes.length > 0) {
                const allRoutesLength = internalSwapRoutes.reduce(
                  (acc, cur) => acc.plus(cur.subRoutes?.flat().length ?? 1),
                  new BigNumber(0),
                );
                specialGasLimit = new BigNumber(baseGasLimit ?? 0)
                  .times(
                    allRoutesLength
                      .plus(BATCH_SEND_TXS_FEE_UP_RATIO_FOR_SWAP)
                      .plus(BATCH_APPROVE_GAS_FEE_RATIO_FOR_SWAP),
                  )
                  .toFixed();
              } else {
                specialGasLimit = new BigNumber(baseGasLimit ?? 0)
                  .times(
                    new BigNumber(BATCH_SEND_TXS_FEE_UP_RATIO_FOR_SWAP).plus(
                      BATCH_APPROVE_GAS_FEE_RATIO_FOR_SWAP,
                    ),
                  )
                  .toFixed();
              }
              const lastTxGasInfo = {
                common: lastTxUseGasInfo?.common,
                gas: lastTxUseGasInfo?.gas
                  ? {
                      ...lastTxUseGasInfo.gas,
                      gasLimit:
                        specialGasLimit ?? lastTxUseGasInfo.gas.gasLimit,
                    }
                  : undefined,
                gasEIP1559: lastTxUseGasInfo?.gasEIP1559
                  ? {
                      ...lastTxUseGasInfo.gasEIP1559,
                      gasLimit:
                        specialGasLimit ?? lastTxUseGasInfo.gasEIP1559.gasLimit,
                    }
                  : undefined,
              };
              updateStepTitle(stepIndex, i, approveUnsignedTxArr);
              lastTxRes = await updateUnsignedTxAndSendTx({
                stepIndex,
                networkId,
                accountId,
                unsignedTxItem,
                gasInfo: lastTxGasInfo,
              });
            } else {
              const estimateFeeParams =
                await backgroundApiProxy.serviceGas.buildEstimateFeeParams({
                  networkId,
                  accountId,
                  encodedTx: unsignedTxItem.encodedTx,
                });
              const gasRes = await backgroundApiProxy.serviceGas.estimateFee({
                ...estimateFeeParams,
                accountAddress: fromUserAddress,
                networkId,
                accountId,
              });
              if (i === unsignedTxArr.length - 2) {
                lastTxUseGasInfo = {
                  common: gasRes.common,
                  gas: gasRes.gas?.[1] ?? gasRes.gas?.[0],
                  gasEIP1559: gasRes.gasEIP1559?.[1] ?? gasRes.gasEIP1559?.[0],
                };
              }
              const gasParseInfo = buildGasInfo(gasRes, gasRes.common);
              updateStepTitle(stepIndex, i, approveUnsignedTxArr);
              await updateUnsignedTxAndSendTx({
                stepIndex,
                networkId,
                accountId,
                unsignedTxItem,
                gasInfo: gasParseInfo,
              });
              void onApproveTxSuccess();
            }
          }
        }
      } else if (
        findGasInfo(stepGasInfos ?? [], unsignedTx.encodedTx) &&
        !needFetchGas
      ) {
        const gasInfoFinal = findGasInfo(
          stepGasInfos ?? [],
          unsignedTx.encodedTx,
        )?.gasInfo;
        if (gasInfoFinal) {
          try {
            lastTxRes = await updateUnsignedTxAndSendTx({
              stepIndex,
              networkId,
              accountId,
              unsignedTxItem: unsignedTx,
              gasInfo: gasInfoFinal,
            });
          } catch (e: any) {
            if (!isApprove) {
              void swapSendTxEvent(
                ESwapEventAPIStatus.FAIL,
                networkId,
                accountId,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                e?.message ?? 'unknown error',
                JSON.stringify(unsignedTx.encodedTx ?? ''),
                swapInfo,
                quoteResult,
              );
            }
            throw e;
          }
        }
      } else {
        const estimateFeeParams =
          await backgroundApiProxy.serviceGas.buildEstimateFeeParams({
            networkId,
            accountId,
            encodedTx: unsignedTx.encodedTx,
          });
        try {
          const gasRes = await backgroundApiProxy.serviceGas.estimateFee({
            ...estimateFeeParams,
            accountAddress: fromUserAddress,
            networkId,
            accountId,
          });
          if (!isApprove) {
            void swapEstimateFeeEvent(
              ESwapEventAPIStatus.SUCCESS,
              networkId,
              accountId,
              undefined,
              JSON.stringify(unsignedTx.encodedTx ?? ''),
              swapInfo,
            );
          }
          const gasParseInfo = buildGasInfo(gasRes, gasRes.common);
          try {
            lastTxRes = await updateUnsignedTxAndSendTx({
              stepIndex,
              networkId,
              accountId,
              unsignedTxItem: unsignedTx,
              gasInfo: gasParseInfo,
            });
            if (!isApprove) {
              void swapSendTxEvent(
                ESwapEventAPIStatus.SUCCESS,
                networkId,
                accountId,
                undefined,
                JSON.stringify(unsignedTx.encodedTx ?? ''),
                swapInfo,
                quoteResult,
              );
            }
          } catch (e: any) {
            if (!isApprove) {
              void swapSendTxEvent(
                ESwapEventAPIStatus.FAIL,
                networkId,
                accountId,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                e?.message ?? 'unknown error',
                JSON.stringify(unsignedTx.encodedTx ?? ''),
                swapInfo,
                quoteResult,
              );
            }
            throw e;
          }
        } catch (e: any) {
          if (!isApprove) {
            void swapEstimateFeeEvent(
              ESwapEventAPIStatus.FAIL,
              networkId,
              accountId,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              e?.message ?? 'unknown error',
              JSON.stringify(unsignedTx.encodedTx ?? ''),
              swapInfo,
            );
          }
          throw e;
        }
      }
      return lastTxRes;
    },
    [
      fromToken,
      fromAccountId,
      fromUserAddress,
      setSwapSteps,
      intl,
      findGasInfo,
      updateStepTitle,
      updateUnsignedTxAndSendTx,
      onApproveTxSuccess,
      swapSendTxEvent,
      swapEstimateFeeEvent,
      buildGasInfo,
    ],
  );

  const getApproveUnsignedTx = useCallback(
    async (
      amount: string,
      isMax: boolean,
      data?: IFetchQuoteResult,
      prevNonce?: number,
    ) => {
      if (data?.allowanceResult?.allowanceTarget && fromUserAddress) {
        const approveInfo: IApproveInfo = {
          owner: fromUserAddress,
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
        if (fromAccountId) {
          const unsignedTx =
            await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
              networkId: data.fromTokenInfo.networkId,
              accountId: fromAccountId ?? '',
              approveInfo,
              prevNonce,
            });
          return { unsignedTx, approveInfo };
        }
      }
      return { unsignedTx: undefined, approveInfo: undefined };
    },
    [fromAccountId, fromUserAddress],
  );
  const approveTxNew = useCallback(
    async (
      stepIndex: number,
      amount: string,
      isMax: boolean,
      data?: IFetchQuoteResult,
      shouldFallback?: boolean,
      shouldWaitApprove?: boolean,
      needFetchGas?: boolean,
    ) => {
      if (data?.allowanceResult?.allowanceTarget && fromUserAddress) {
        const approveInfo: IApproveInfo = {
          owner: fromUserAddress,
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
        if (fromAccountId) {
          if (shouldFallback) {
            await navigationToTxConfirm({
              isInternalSwap: true,
              approvesInfo: [approveInfo],
              onSuccess: (successData: ISendTxOnSuccessData[]) =>
                handleApproveFallbackOnSuccess(
                  stepIndex,
                  successData,
                  shouldWaitApprove,
                ),
              onCancel: () => handleApproveFallbackOnCancel(stepIndex),
            });
          } else {
            const res = await sendTxActions(
              true,
              stepIndex,
              data.fromTokenInfo.networkId,
              fromAccountId ?? '',
              {
                networkId: data.fromTokenInfo.networkId,
                accountId: fromAccountId ?? '',
                approveInfo,
              },
              undefined,
              data,
              needFetchGas,
            );
            if (res) {
              void onApproveTxSuccess();
            }
            return res;
          }
        }
      }
    },
    [
      onApproveTxSuccess,
      handleApproveFallbackOnCancel,
      handleApproveFallbackOnSuccess,
      navigationToTxConfirm,
      sendTxActions,
      fromAccountId,
      fromUserAddress,
    ],
  );

  const swapBuildFinish = useCallback(
    async (
      buildSwapRes: { orderId?: string; result?: IFetchQuoteResult },
      quoteResult?: IFetchQuoteResult,
    ) => {
      let swapType = ESwapTabSwitchType.SWAP;
      if (buildSwapRes?.result?.protocol === EProtocolOfExchange.SWAP) {
        void syncRecentTokenPairs({
          swapFromToken: fromToken as ISwapToken,
          swapToToken: toToken as ISwapToken,
        });
      } else if (buildSwapRes?.result?.protocol === EProtocolOfExchange.LIMIT) {
        swapType = ESwapTabSwitchType.LIMIT;
        appEventBus.emit(
          EAppEventBusNames.SwapLimitOrderBuildSuccess,
          undefined,
        );
        void backgroundApiProxy.serviceSwap.swapLimitOrdersFetchLoop(
          fromAccountIndexedAccountId,
          !fromAccountIndexedAccountId
            ? fromAccountId ?? dbAccountId
            : undefined,
          true,
        );
      }
      if (
        buildSwapRes.result?.fromTokenInfo.networkId !==
        buildSwapRes.result?.toTokenInfo.networkId
      ) {
        swapType = ESwapTabSwitchType.BRIDGE;
      }
      defaultLogger.swap.createSwapOrder.swapCreateOrder({
        fromTokenAmount: buildSwapRes.result?.fromAmount ?? '',
        toTokenAmount: buildSwapRes.result?.toAmount ?? '',
        quoteToTokenAmount: quoteResult?.toAmount ?? '',
        fromAddress: fromUserAddress ?? '',
        toAddress: toUserAddress ?? '',
        status: ESwapEventAPIStatus.SUCCESS,
        swapProvider: buildSwapRes.result?.info.provider ?? '',
        swapProviderName: buildSwapRes.result?.info.providerName ?? '',
        swapType,
        slippage: slippageItem.value.toString(),
        sourceChain: buildSwapRes.result?.fromTokenInfo.networkId ?? '',
        receivedChain: buildSwapRes.result?.toTokenInfo.networkId ?? '',
        sourceTokenSymbol: buildSwapRes.result?.fromTokenInfo.symbol ?? '',
        receivedTokenSymbol: buildSwapRes.result?.toTokenInfo.symbol ?? '',
        feeType: buildSwapRes.result?.fee?.percentageFee?.toString() ?? '0',
        router: JSON.stringify(buildSwapRes.result?.routesData ?? ''),
        isFirstTime: isFirstTimeSwap,
        createFrom: isModalPage ? 'modal' : 'swapPage',
        orderId: buildSwapRes?.orderId ?? '',
      });
      setPersistSettings((prev) => ({
        ...prev,
        isFirstTimeSwap: false,
      }));
    },
    [
      fromToken,
      isFirstTimeSwap,
      isModalPage,
      setPersistSettings,
      slippageItem.value,
      fromAccountId,
      dbAccountId,
      fromAccountIndexedAccountId,
      fromUserAddress,
      toUserAddress,
      syncRecentTokenPairs,
      toToken,
    ],
  );

  const buildSwapAction = useCallback(
    async (
      currentFromToken?: ISwapToken,
      currentToToken?: ISwapToken,
      data?: IFetchQuoteResult,
    ) => {
      if (
        data?.fromTokenInfo &&
        data?.toTokenInfo &&
        data.fromAmount &&
        slippageItem &&
        data?.toAmount &&
        fromUserAddress &&
        toUserAddress &&
        fromAccountNetworkId &&
        fromAccountId
      ) {
        if (swapStepsRef.current.preSwapData.swapBuildResultData) {
          return swapStepsRef.current.preSwapData.swapBuildResultData;
        }
        const checkRes = await checkOtherFee(data);
        if (!checkRes) {
          throw new OneKeyError('checkOtherFee failed');
        }
        let buildSwapRes: IFetchBuildTxResponse | undefined;
        try {
          setSwapSteps((prev) => ({
            ...prev,
            preSwapData: {
              ...prev.preSwapData,
              swapBuildLoading: true,
            },
          }));
          buildSwapRes = await backgroundApiProxy.serviceSwap.fetchBuildTx({
            fromToken: data.fromTokenInfo,
            toToken: data.toTokenInfo,
            toTokenAmount: data.toAmount,
            fromTokenAmount: data.fromAmount,
            slippagePercentage: slippageItem.value,
            receivingAddress: toUserAddress ?? '',
            userAddress: fromUserAddress,
            provider: data?.info.provider,
            accountId: fromAccountId ?? '',
            quoteResultCtx: data?.quoteResultCtx,
            protocol: data.protocol ?? EProtocolOfExchange.SWAP,
            kind: data.kind ?? ESwapQuoteKind.SELL,
            walletType: swapFromAddressInfo.accountInfo?.wallet?.type ?? '',
          });
        } catch (e: any) {
          setSwapSteps((prev) => ({
            ...prev,
            preSwapData: {
              ...prev.preSwapData,
              swapBuildLoading: false,
            },
          }));
          let swapType = ESwapTabSwitchType.SWAP;
          if (data?.protocol === EProtocolOfExchange.LIMIT) {
            swapType = ESwapTabSwitchType.LIMIT;
          } else if (
            data?.fromTokenInfo.networkId !== data?.toTokenInfo.networkId
          ) {
            swapType = ESwapTabSwitchType.BRIDGE;
          }
          defaultLogger.swap.createSwapOrder.swapCreateOrder({
            fromTokenAmount: data?.fromAmount ?? '',
            toTokenAmount: buildSwapRes?.result?.toAmount ?? '',
            quoteToTokenAmount: data?.toAmount ?? '',
            fromAddress: fromUserAddress ?? '',
            toAddress: toUserAddress ?? '',
            status: ESwapEventAPIStatus.FAIL,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            message: e?.message ?? 'unknown error',
            swapProvider: data?.info.provider ?? '',
            swapProviderName: data?.info.providerName ?? '',
            swapType,
            slippage: slippageItem.value.toString(),
            sourceChain: data?.fromTokenInfo.networkId ?? '',
            receivedChain: data?.toTokenInfo.networkId ?? '',
            sourceTokenSymbol: data?.fromTokenInfo.symbol ?? '',
            receivedTokenSymbol: data?.toTokenInfo.symbol ?? '',
            feeType: data?.fee?.percentageFee?.toString() ?? '0',
            router: JSON.stringify(data?.routesData ?? ''),
            isFirstTime: isFirstTimeSwap,
            createFrom: isModalPage ? 'modal' : 'swapPage',
            orderId: buildSwapRes?.orderId ?? '',
          });
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const ne = new Error(e?.message ?? 'unknown error');
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          ne.name = 'buildSwapApi';
          throw ne;
        }
        let skipSendTransAction = false;
        if (buildSwapRes) {
          let transferInfo: ITransferInfo | undefined;
          let encodedTx: IEncodedTx | undefined;
          if (buildSwapRes?.swftOrder) {
            encodedTx = undefined;
            // swft order
            transferInfo = {
              from: fromUserAddress ?? '',
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
              from: fromUserAddress ?? '',
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
              from: fromUserAddress ?? '',
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
                accountId: fromAccountId ?? '',
                networkId: buildSwapRes.result.fromTokenInfo.networkId,
                okxTx: buildSwapRes.OKXTxObject,
                fromTokenInfo: buildSwapRes.result.fromTokenInfo,
                type: swapTypeSwitch,
              });
          } else if (buildSwapRes.tronTxData) {
            transferInfo = undefined;
            encodedTx = buildSwapRes.tronTxData;
          } else if (buildSwapRes.xrpTxData) {
            transferInfo = undefined;
            encodedTx = buildSwapRes.xrpTxData;
          } else if (buildSwapRes?.tx) {
            transferInfo = undefined;
            if (typeof buildSwapRes.tx !== 'string' && buildSwapRes.tx.data) {
              const valueHex = toBigIntHex(
                new BigNumber(buildSwapRes.tx.value ?? 0),
              );
              encodedTx = {
                ...buildSwapRes?.tx,
                value: valueHex,
                from: fromUserAddress ?? '',
              };
            } else {
              encodedTx = buildSwapRes.tx as string;
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          } else if (buildSwapRes.btcData || buildSwapRes.suiBase64Data) {
            let inputTx: IStakeTx | undefined;
            if (buildSwapRes.btcData) {
              if (
                buildSwapRes.btcData.addressType.includes(
                  swapFromAddressInfo.accountInfo?.deriveInfo
                    ?.addressEncoding ?? '',
                )
              ) {
                inputTx = {
                  psbtHex: buildSwapRes.btcData.hexStr,
                };
              } else {
                Toast.error({
                  title: intl.formatMessage({
                    id: ETranslations.feedback_derivation_path_restriction,
                  }),
                });
              }
            }
            if (buildSwapRes.suiBase64Data) {
              inputTx = buildSwapRes.suiBase64Data;
            }
            if (inputTx) {
              encodedTx =
                await backgroundApiProxy.serviceStaking.buildInternalDappTx({
                  accountId: fromAccountId ?? '',
                  networkId: fromAccountNetworkId ?? '',
                  tx: inputTx,
                  internalDappType: EInternalDappEnum.Swap,
                });
            }
          } else if (
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            buildSwapRes?.ctx?.cowSwapOrderId ||
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            buildSwapRes?.ctx?.oneInchFusionOrderHash
          ) {
            skipSendTransAction = true;
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
              token: currentFromToken ?? buildSwapRes.result.fromTokenInfo,
              accountInfo: {
                accountId: fromAccountId ?? '',
                networkId: buildSwapRes.result.fromTokenInfo.networkId,
              },
            },
            receiver: {
              amount: buildSwapRes.result.toAmount ?? data.toAmount,
              token: currentToToken ?? buildSwapRes.result.toTokenInfo,
              accountInfo: {
                accountId: toAccountId ?? '',
                networkId: buildSwapRes.result.toTokenInfo.networkId,
              },
            },
            accountAddress: fromUserAddress ?? '',
            receivingAddress: toUserAddress ?? '',
            swapBuildResData: {
              ...buildSwapRes,
              result: {
                ...buildSwapRes.result,
                slippage: buildSwapRes.result.slippage ?? slippageItem.value,
              },
            },
          };
          const orderId =
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            buildSwapRes?.ctx?.cowSwapOrderId ??
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            buildSwapRes?.ctx?.oneInchFusionOrderHash ??
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            buildSwapRes?.ctx?.changeHeroOrderId ??
            '';
          setSwapSteps((prev) => ({
            ...prev,
            preSwapData: {
              ...prev.preSwapData,
              swapBuildLoading: false,
              toTokenAmount: buildSwapRes.result.toAmount ?? data.toAmount,
              swapBuildResultData: {
                swapInfo,
                orderId,
                skipSendTransAction,
                encodedTx,
                transferInfo,
              },
            },
          }));
          void swapBuildFinish(buildSwapRes, data);
          return {
            swapInfo,
            orderId,
            skipSendTransAction,
            encodedTx,
            transferInfo,
          };
        }
      }
      setSwapSteps((prev) => ({
        ...prev,
        preSwapData: {
          ...prev.preSwapData,
          swapBuildLoading: false,
        },
      }));
      return {};
    },
    [
      slippageItem,
      fromUserAddress,
      toUserAddress,
      fromAccountNetworkId,
      fromAccountId,
      setSwapSteps,
      checkOtherFee,
      swapFromAddressInfo.accountInfo?.wallet?.type,
      swapFromAddressInfo.accountInfo?.deriveInfo?.addressEncoding,
      isFirstTimeSwap,
      isModalPage,
      toAccountId,
      swapBuildFinish,
      swapTypeSwitch,
      intl,
    ],
  );

  const buildTxNew = useCallback(
    async (
      stepIndex: number,
      currentFromToken?: ISwapToken,
      currentToToken?: ISwapToken,
      data?: IFetchQuoteResult,
      approveUnsignedTxArr?: IUnsignedTxPro[],
      shouldFallback?: boolean,
      fallbackApproveInfos?: IApproveInfo[],
      needFetchGas?: boolean,
    ) => {
      if (
        data?.fromTokenInfo &&
        data?.toTokenInfo &&
        data.fromAmount &&
        slippageItem &&
        data?.toAmount &&
        fromUserAddress &&
        toUserAddress &&
        fromAccountNetworkId &&
        fromAccountId
      ) {
        setSwapSteps(
          (prev: {
            steps: ISwapStep[];
            preSwapData: ISwapPreSwapData;
            quoteResult?: IFetchQuoteResult | undefined;
          }) => {
            const newSteps = cloneDeep(prev.steps);
            newSteps[stepIndex] = {
              ...newSteps[stepIndex],
              stepSubTitle: intl.formatMessage({
                id: ETranslations.swap_process_create_order,
              }),
            };
            return {
              ...prev,
              steps: newSteps,
            };
          },
        );
        const {
          skipSendTransAction,
          encodedTx,
          transferInfo,
          swapInfo,
          orderId,
        } = await buildSwapAction(currentFromToken, currentToToken, data);
        if (swapInfo) {
          if (skipSendTransAction) {
            void handleBuildTxSuccessWithSignedNoSend({
              swapInfo,
              orderId,
            });
          } else if (shouldFallback) {
            await navigationToTxConfirm({
              isInternalSwap: true,
              transfersInfo: transferInfo ? [transferInfo] : undefined,
              encodedTx,
              approvesInfo:
                fallbackApproveInfos?.length && shouldFallback
                  ? fallbackApproveInfos
                  : undefined,
              swapInfo,
              onSuccess: (successData: ISendTxOnSuccessData[]) =>
                handleBuildTxFallbackOnSuccess(successData, orderId),
              onCancel: () => handleBuildTxFallbackOnCancel(stepIndex),
            });
            setSwapSteps(
              (prev: {
                steps: ISwapStep[];
                preSwapData: ISwapPreSwapData;
                quoteResult?: IFetchQuoteResult | undefined;
              }) => {
                const newSteps = cloneDeep(prev.steps);
                newSteps[stepIndex] = {
                  ...newSteps[stepIndex],
                  stepSubTitle: intl.formatMessage({
                    id: ETranslations.swap_process_build_and_estimate_tx,
                  }),
                };
                return {
                  ...prev,
                  steps: newSteps,
                };
              },
            );
          } else {
            const sendTxRes = await sendTxActions(
              false,
              stepIndex,
              fromAccountNetworkId ?? '',
              fromAccountId ?? '',
              {
                networkId: fromAccountNetworkId ?? '',
                accountId: fromAccountId ?? '',
                transfersInfo: transferInfo ? [transferInfo] : undefined,
                encodedTx,
                swapInfo,
              },
              approveUnsignedTxArr,
              data,
              needFetchGas,
            );
            if (sendTxRes) {
              void onBuildTxSuccess(sendTxRes.txid, swapInfo, orderId);
            }
          }
        }
      }
    },
    [
      slippageItem,
      fromUserAddress,
      toUserAddress,
      fromAccountNetworkId,
      fromAccountId,
      setSwapSteps,
      buildSwapAction,
      intl,
      handleBuildTxSuccessWithSignedNoSend,
      navigationToTxConfirm,
      handleBuildTxFallbackOnSuccess,
      handleBuildTxFallbackOnCancel,
      sendTxActions,
      onBuildTxSuccess,
    ],
  );

  const signMessage = useCallback(
    async (
      stepIndex: number,
      currentFromToken?: ISwapToken,
      currentToToken?: ISwapToken,
      data?: IFetchQuoteResult,
      needFetchGas?: boolean,
    ) => {
      if (
        data?.fromTokenInfo &&
        data?.toTokenInfo &&
        data.fromAmount &&
        slippageItem &&
        data?.toAmount &&
        fromUserAddress &&
        toUserAddress &&
        fromAccountNetworkId &&
        fromAccountId
      ) {
        const selectQuoteRes = cloneDeep(data);
        if (selectQuoteRes.swapShouldSignedData && fromAccountId) {
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
            unSignedOrder.receiver = toUserAddress ?? '';
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
                    payload: [fromUserAddress.toLowerCase(), dataMessage],
                  },
                  networkId: fromAccountNetworkId ?? '',
                  accountId: fromAccountId ?? '',
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
                const buildTxRes = await buildTxNew(
                  stepIndex,
                  currentFromToken,
                  currentToToken,
                  selectQuoteRes,
                  undefined,
                  undefined,
                  undefined,
                  needFetchGas,
                );
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
                    payload: [fromUserAddress.toLowerCase(), dataMessage],
                  },
                  networkId: fromAccountNetworkId ?? '',
                  accountId: fromAccountId ?? '',
                },
              );
              if (signHash) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                selectQuoteRes.quoteResultCtx.oneInchFusionOrderCtx = {
                  ...onInchFusionOrderInfo,
                  signature: signHash,
                };
                const buildTxRes = await buildTxNew(
                  stepIndex,
                  currentFromToken,
                  currentToToken,
                  selectQuoteRes,
                  undefined,
                  undefined,
                  undefined,
                  needFetchGas,
                );
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
      fromAccountId,
      fromUserAddress,
      fromAccountNetworkId,
      swapLimitExpirationTime.value,
      swapLimitPartiallyFillObj.value,
      swapLimitPriceFromAmount,
      swapLimitPriceToAmount,
      toUserAddress,
    ],
  );

  const wrappedTx = useCallback(
    async (
      stepIndex: number,
      data?: IFetchQuoteResult,
      fromTokenInfo?: ISwapToken,
      toTokenInfo?: ISwapToken,
      needFetchGas?: boolean,
    ) => {
      if (
        fromTokenInfo &&
        toTokenInfo &&
        fromUserAddress &&
        toUserAddress &&
        data?.fromAmount &&
        fromAccountId
      ) {
        setSwapBuildTxFetching(true);
        const wrappedType = fromTokenInfo.isNative
          ? EWrappedType.DEPOSIT
          : EWrappedType.WITHDRAW;
        const wrappedInfo: IWrappedInfo = {
          from: fromUserAddress ?? '',
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
              accountId: fromAccountId ?? '',
              networkId: fromTokenInfo.networkId,
            },
          },
          receiver: {
            amount: data.toAmount ?? '',
            token: toTokenInfo,
            accountInfo: {
              accountId: toAccountId ?? '',
              networkId: toTokenInfo.networkId,
            },
          },
          accountAddress: fromUserAddress ?? '',
          receivingAddress: toUserAddress ?? '',
          swapBuildResData: {
            result: { ...data },
            orderId: data.quoteId ?? '',
          },
        };

        const sendTxRes = await sendTxActions(
          false,
          stepIndex,
          fromTokenInfo.networkId,
          fromAccountId ?? '',
          {
            networkId: fromTokenInfo.networkId,
            accountId: fromAccountId ?? '',
            wrappedInfo,
            swapInfo,
          },
          undefined,
          data,
          needFetchGas,
        );

        if (sendTxRes) {
          void syncRecentTokenPairs({
            swapFromToken: fromTokenInfo,
            swapToToken: toTokenInfo,
          });
          void onBuildTxSuccess(sendTxRes.txid, swapInfo);
          return sendTxRes;
        }
      }
    },
    [
      fromUserAddress,
      toUserAddress,
      fromAccountId,
      setSwapBuildTxFetching,
      toAccountId,
      sendTxActions,
      syncRecentTokenPairs,
      onBuildTxSuccess,
    ],
  );

  const getApproveUnSignedTxArr = useCallback(
    async (data?: IFetchQuoteResult) => {
      let unsignedTxArr: IUnsignedTxPro[] = [];
      let fallbackApproveInfos: IApproveInfo[] = [];
      if (
        data?.fromTokenInfo &&
        data?.toTokenInfo &&
        data.fromAmount &&
        slippageItem &&
        data?.toAmount &&
        fromUserAddress &&
        toUserAddress &&
        fromAccountNetworkId &&
        fromAccountId
      ) {
        let prevNonce: number | undefined;
        if (data.allowanceResult) {
          if (data.allowanceResult.shouldResetApprove) {
            const {
              unsignedTx: resetApproveUnsignedTx,
              approveInfo: resetApproveApproveInfo,
            } = await getApproveUnsignedTx(
              '0',
              !!swapActionState.approveUnLimit,
              data,
            );
            if (resetApproveUnsignedTx) {
              unsignedTxArr = [...unsignedTxArr, resetApproveUnsignedTx];
              prevNonce = resetApproveUnsignedTx.nonce;
            }
            if (resetApproveApproveInfo) {
              fallbackApproveInfos = [
                ...fallbackApproveInfos,
                resetApproveApproveInfo,
              ];
            }
          }
          const {
            unsignedTx: approveUnsignedTx,
            approveInfo: approveApproveInfo,
          } = await getApproveUnsignedTx(
            data.fromAmount,
            !!swapActionState.approveUnLimit,
            data,
            prevNonce,
          );
          if (approveUnsignedTx) {
            unsignedTxArr = [...unsignedTxArr, approveUnsignedTx];
          }
          if (approveApproveInfo) {
            fallbackApproveInfos = [
              ...fallbackApproveInfos,
              approveApproveInfo,
            ];
          }
        }
      }
      return {
        unsignedTxArr,
        fallbackApproveInfos,
      };
    },
    [
      slippageItem,
      fromUserAddress,
      fromAccountNetworkId,
      fromAccountId,
      toUserAddress,
      getApproveUnsignedTx,
      swapActionState.approveUnLimit,
    ],
  );
  const batchApproveSwap = useCallback(
    async (
      stepIndex: number,
      currentFromToken?: ISwapToken,
      currentToToken?: ISwapToken,
      data?: IFetchQuoteResult,
      shouldFallback?: boolean,
      needFetchGas?: boolean,
    ) => {
      if (
        data?.fromTokenInfo &&
        data?.toTokenInfo &&
        data.fromAmount &&
        slippageItem &&
        data?.toAmount &&
        fromUserAddress &&
        toUserAddress &&
        fromAccountNetworkId &&
        fromAccountId
      ) {
        const { unsignedTxArr, fallbackApproveInfos } =
          await getApproveUnSignedTxArr(data);
        await buildTxNew(
          stepIndex,
          currentFromToken,
          currentToToken,
          data,
          unsignedTxArr,
          shouldFallback,
          fallbackApproveInfos,
          needFetchGas,
        );
      }
    },
    [
      slippageItem,
      fromUserAddress,
      fromAccountNetworkId,
      fromAccountId,
      toUserAddress,
      getApproveUnSignedTxArr,
      buildTxNew,
    ],
  );

  const estimateNetworkFee = useCallback(
    async (
      networkId: string,
      accountId: string,
      buildUnsignedParams: ISendTxBaseParams & IBuildUnsignedTxParams,
      approveUnsignedTxArr?: IUnsignedTxPro[],
    ) => {
      if (!fromToken || !fromAccountId || !fromUserAddress) {
        throw new OneKeyError('account error');
      }
      const swapInfo = buildUnsignedParams?.swapInfo;
      const buildUnsignedParamsCheckNonce = { ...buildUnsignedParams };
      if (approveUnsignedTxArr?.length && approveUnsignedTxArr.length > 0) {
        buildUnsignedParamsCheckNonce.prevNonce =
          approveUnsignedTxArr[approveUnsignedTxArr.length - 1].nonce;
      }
      let gasFeeInfos: { encodeTx: IEncodedTx; gasInfo: ISwapGasInfo }[] = [];
      const unsignedTx =
        await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
          ...buildUnsignedParamsCheckNonce,
          isInternalSwap: true,
        });

      setSwapSteps((prev) => ({
        ...prev,
        preSwapData: {
          ...prev.preSwapData,
          estimateNetworkFeeLoading: true,
        },
      }));
      try {
        const vaultSettings =
          await backgroundApiProxy.serviceNetwork.getVaultSettings({
            networkId,
          });
        if (
          approveUnsignedTxArr?.length &&
          approveUnsignedTxArr.length > 0 &&
          vaultSettings.supportBatchEstimateFee?.[networkId]
        ) {
          const unsignedTxArr = [...approveUnsignedTxArr, unsignedTx];
          const estimateFeeParamsArr = await Promise.all(
            unsignedTxArr.map((o) =>
              backgroundApiProxy.serviceGas.buildEstimateFeeParams({
                networkId,
                accountId,
                encodedTx: o.encodedTx,
              }),
            ),
          );
          try {
            const gasResArr =
              await backgroundApiProxy.serviceGas.batchEstimateFee({
                networkId,
                accountId,
                encodedTxs: estimateFeeParamsArr.map((o) => o.encodedTx ?? {}),
              });
            void swapEstimateFeeEvent(
              ESwapEventAPIStatus.SUCCESS,
              networkId,
              accountId,
              undefined,
              JSON.stringify(
                estimateFeeParamsArr.map((o) => o.encodedTx ?? {}) ?? '',
              ),
              swapInfo,
              true,
            );
            for (let i = 0; i < unsignedTxArr.length; i += 1) {
              const unsignedTxItem = unsignedTxArr[i];
              const gasRes = gasResArr.txFees[i];
              const gasInfo = buildGasInfo(gasRes, gasResArr.common);
              gasFeeInfos = [
                ...gasFeeInfos,
                {
                  encodeTx: unsignedTxItem.encodedTx ?? {},
                  gasInfo,
                },
              ];
            }
          } catch (e: any) {
            void swapEstimateFeeEvent(
              ESwapEventAPIStatus.FAIL,
              networkId,
              accountId,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              e?.message ?? 'unknown error',
              JSON.stringify(
                estimateFeeParamsArr.map((o) => o.encodedTx ?? {}) ?? '',
              ),
              swapInfo,
              true,
            );
            throw e;
          }
        } else if (
          approveUnsignedTxArr?.length &&
          approveUnsignedTxArr.length > 0
        ) {
          const unsignedTxArr = [...approveUnsignedTxArr, unsignedTx];
          let lastTxUseGasInfo: IFeeInfoUnit | undefined;
          for (let i = 0; i < unsignedTxArr.length; i += 1) {
            const unsignedTxItem = unsignedTxArr[i];
            if (i === unsignedTxArr.length - 1) {
              let specialGasLimit: string | undefined;
              const unsignedTxSwapInfo = unsignedTxItem.swapInfo;
              const internalSwapGasLimit =
                unsignedTxSwapInfo?.swapBuildResData.result.gasLimit;
              const internalSwapRoutes =
                unsignedTxSwapInfo?.swapBuildResData.result.routesData;
              const baseGasLimit =
                lastTxUseGasInfo?.gas?.gasLimit ??
                lastTxUseGasInfo?.gasEIP1559?.gasLimit;
              if (!isNil(internalSwapGasLimit)) {
                specialGasLimit = new BigNumber(internalSwapGasLimit).toFixed();
              } else if (internalSwapRoutes && internalSwapRoutes.length > 0) {
                const allRoutesLength = internalSwapRoutes.reduce(
                  (acc, cur) => acc.plus(cur.subRoutes?.flat().length ?? 1),
                  new BigNumber(0),
                );
                specialGasLimit = new BigNumber(baseGasLimit ?? 0)
                  .times(
                    allRoutesLength
                      .plus(BATCH_SEND_TXS_FEE_UP_RATIO_FOR_SWAP)
                      .plus(BATCH_APPROVE_GAS_FEE_RATIO_FOR_SWAP),
                  )
                  .toFixed();
              } else {
                specialGasLimit = new BigNumber(baseGasLimit ?? 0)
                  .times(
                    new BigNumber(BATCH_SEND_TXS_FEE_UP_RATIO_FOR_SWAP).plus(
                      BATCH_APPROVE_GAS_FEE_RATIO_FOR_SWAP,
                    ),
                  )

                  .toFixed();
              }
              const lastTxGasInfo = {
                common: lastTxUseGasInfo?.common,
                gas: lastTxUseGasInfo?.gas
                  ? {
                      ...lastTxUseGasInfo.gas,
                      gasLimit:
                        specialGasLimit ?? lastTxUseGasInfo.gas.gasLimit,
                    }
                  : undefined,
                gasEIP1559: lastTxUseGasInfo?.gasEIP1559
                  ? {
                      ...lastTxUseGasInfo.gasEIP1559,
                      gasLimit:
                        specialGasLimit ?? lastTxUseGasInfo.gasEIP1559.gasLimit,
                    }
                  : undefined,
              };
              gasFeeInfos = [
                ...gasFeeInfos,
                {
                  encodeTx: unsignedTxItem.encodedTx,
                  gasInfo: lastTxGasInfo,
                },
              ];
            } else {
              const estimateFeeParams =
                await backgroundApiProxy.serviceGas.buildEstimateFeeParams({
                  networkId,
                  accountId,
                  encodedTx: unsignedTxItem.encodedTx,
                });
              const gasRes = await backgroundApiProxy.serviceGas.estimateFee({
                ...estimateFeeParams,
                accountAddress: fromUserAddress ?? '',
                networkId,
                accountId,
              });
              if (i === unsignedTxArr.length - 2) {
                lastTxUseGasInfo = {
                  common: gasRes.common,
                  gas: gasRes.gas?.[1] ?? gasRes.gas?.[0],
                  gasEIP1559: gasRes.gasEIP1559?.[1] ?? gasRes.gasEIP1559?.[0],
                };
              }
              const gasParseInfo = buildGasInfo(gasRes, gasRes.common);
              gasFeeInfos = [
                ...gasFeeInfos,
                {
                  encodeTx: unsignedTxItem.encodedTx,
                  gasInfo: gasParseInfo,
                },
              ];
            }
          }
        } else {
          const estimateFeeParams =
            await backgroundApiProxy.serviceGas.buildEstimateFeeParams({
              networkId,
              accountId,
              encodedTx: unsignedTx.encodedTx,
            });
          try {
            const gasRes = await backgroundApiProxy.serviceGas.estimateFee({
              ...estimateFeeParams,
              accountAddress: fromUserAddress ?? '',
              networkId,
              accountId,
            });
            void swapEstimateFeeEvent(
              ESwapEventAPIStatus.SUCCESS,
              networkId,
              accountId,
              undefined,
              JSON.stringify(unsignedTx.encodedTx ?? ''),
              swapInfo,
            );
            const gasParseInfo = buildGasInfo(gasRes, gasRes.common);
            gasFeeInfos = [
              ...gasFeeInfos,
              {
                encodeTx: unsignedTx.encodedTx,
                gasInfo: gasParseInfo,
              },
            ];
          } catch (e: any) {
            void swapEstimateFeeEvent(
              ESwapEventAPIStatus.FAIL,
              networkId,
              accountId,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              e?.message ?? 'unknown error',
              JSON.stringify(unsignedTx.encodedTx ?? ''),
              swapInfo,
            );

            throw e;
          }
        }
        const gasFeeFiatValues = await Promise.all(
          gasFeeInfos.map(async (item) => {
            const { gasInfo } = item;
            const { common } = gasInfo;
            const feeResult = calculateFeeForSend({
              feeInfo: gasInfo as IFeeInfoUnit,
              nativeTokenPrice: common?.nativeTokenPrice ?? 0,
            });
            return feeResult.totalFiatMinForDisplay;
          }),
        );
        const gasFeeFiatValueAll = gasFeeFiatValues.reduce((acc, curr) => {
          return acc.plus(new BigNumber(curr));
        }, new BigNumber(0));
        setSwapSteps((prev) => ({
          ...prev,
          preSwapData: {
            ...prev.preSwapData,
            netWorkFee: {
              ...prev.preSwapData.netWorkFee,
              gasInfos: [...gasFeeInfos],
              gasFeeFiatValue: !gasFeeFiatValueAll.isZero()
                ? gasFeeFiatValueAll.toFixed()
                : undefined,
            },
            estimateNetworkFeeLoading: false,
          },
        }));
      } catch (e: any) {
        setSwapSteps((prev) => ({
          ...prev,
          preSwapData: {
            ...prev.preSwapData,
            estimateNetworkFeeLoading: false,
          },
        }));
      }
    },
    [
      buildGasInfo,
      fromToken,
      setSwapSteps,
      swapEstimateFeeEvent,
      fromAccountId,
      fromUserAddress,
    ],
  );

  const preSwapBeforeStepActions = useCallback(
    async (
      data?: IFetchQuoteResult,
      currentFromToken?: ISwapToken,
      currentToToken?: ISwapToken,
    ) => {
      if (
        data?.fromTokenInfo &&
        data?.toTokenInfo &&
        data.fromAmount &&
        slippageItem &&
        data?.toAmount &&
        fromUserAddress &&
        toUserAddress &&
        fromAccountNetworkId &&
        fromAccountId
      ) {
        setSwapSteps((prev) => ({
          ...prev,
          preSwapData: {
            ...prev.preSwapData,
            stepBeforeActionsLoading: true,
          },
        }));
        try {
          const { swapInfo, transferInfo, encodedTx } = await buildSwapAction(
            currentFromToken,
            currentToToken,
            data,
          );
          const { unsignedTxArr } = await getApproveUnSignedTxArr(data);
          await estimateNetworkFee(
            fromAccountNetworkId ?? '',
            fromAccountId ?? '',
            {
              networkId: fromAccountNetworkId ?? '',
              accountId: fromAccountId ?? '',
              transfersInfo: transferInfo ? [transferInfo] : undefined,
              encodedTx,
              swapInfo,
            },
            unsignedTxArr,
          );
          setSwapSteps((prev) => ({
            ...prev,
            preSwapData: {
              ...prev.preSwapData,
              stepBeforeActionsLoading: false,
            },
          }));
        } catch (e) {
          setSwapSteps((prev) => ({
            ...prev,
            preSwapData: {
              ...prev.preSwapData,
              stepBeforeActionsLoading: false,
            },
          }));
        }
      }
    },
    [
      buildSwapAction,
      estimateNetworkFee,
      getApproveUnSignedTxArr,
      setSwapSteps,
      slippageItem,
      fromAccountId,
      fromAccountNetworkId,
      fromUserAddress,
      toUserAddress,
    ],
  );

  const preSwapStepsStart = useCallback(
    async (swapStepsValues?: {
      steps: ISwapStep[];
      preSwapData: ISwapPreSwapData;
      quoteResult?: IFetchQuoteResult;
    }) => {
      const swapStepsValuesFinal = swapStepsValues?.steps ?? swapSteps.steps;
      const preSwapDataFinal =
        swapStepsValues?.preSwapData ?? swapSteps.preSwapData;
      const quoteResultFinal =
        swapStepsValues?.quoteResult ?? swapSteps.quoteResult;
      if (swapStepsValuesFinal.length > 0) {
        for (let i = 0; i < swapStepsValuesFinal.length; i += 1) {
          const stepIndex = i;
          const step = swapStepsValuesFinal[i];
          const { type, isResetApprove, canRetry, status } = step;
          if (
            status === ESwapStepStatus.READY ||
            (canRetry && status === ESwapStepStatus.FAILED)
          ) {
            try {
              setSwapSteps(
                (prevSteps: {
                  steps: ISwapStep[];
                  preSwapData: ISwapPreSwapData;
                }) => {
                  const newSteps = [...prevSteps.steps];
                  newSteps[i] = {
                    ...newSteps[i],
                    status: ESwapStepStatus.LOADING,
                    errorMessage: undefined,
                  };
                  return {
                    ...prevSteps,
                    steps: newSteps,
                  };
                },
              );
              if (type === ESwapStepType.APPROVE_TX) {
                let approveAmount = quoteResultFinal?.fromAmount ?? '0';
                let approveSendTx: ISignedTxPro | undefined;
                if (isResetApprove) {
                  approveAmount = '0';
                  approveSendTx = await approveTxNew(
                    stepIndex,
                    approveAmount,
                    !!swapActionState.approveUnLimit,
                    quoteResultFinal,
                    preSwapDataFinal?.shouldFallback,
                    step.shouldWaitApproved,
                    preSwapDataFinal?.needFetchGas,
                  );
                } else {
                  approveSendTx = await approveTxNew(
                    stepIndex,
                    approveAmount,
                    !!swapActionState.approveUnLimit,
                    quoteResultFinal,
                    preSwapDataFinal?.shouldFallback,
                    step.shouldWaitApproved,
                    preSwapDataFinal?.needFetchGas,
                  );
                }
                if (
                  step.shouldWaitApproved ||
                  preSwapDataFinal?.shouldFallback
                ) {
                  setSwapSteps(
                    (prevSteps: {
                      steps: ISwapStep[];
                      preSwapData: ISwapPreSwapData;
                      quoteResult?: IFetchQuoteResult | undefined;
                    }) => {
                      const newSteps = [...prevSteps.steps];
                      newSteps[i] = {
                        ...newSteps[i],
                        status: ESwapStepStatus.PENDING,
                        txHash: approveSendTx?.txid,
                        stepSubTitle: intl.formatMessage({
                          id: ETranslations.swap_btn_approving,
                        }),
                      };
                      return {
                        ...prevSteps,
                        steps: newSteps,
                      };
                    },
                  );
                  if (
                    preSwapDataFinal?.fromToken &&
                    preSwapDataFinal?.toToken
                  ) {
                    setInAppNotificationAtom((pre) => {
                      if (
                        preSwapDataFinal?.fromToken &&
                        preSwapDataFinal?.toToken
                      ) {
                        return {
                          ...pre,
                          swapApprovingTransaction: {
                            txId: approveSendTx?.txid,
                            swapType: swapTypeSwitch,
                            protocol:
                              quoteResultFinal?.protocol ??
                              EProtocolOfExchange.SWAP,
                            provider: quoteResultFinal?.info.provider ?? '',
                            providerName:
                              quoteResultFinal?.info.providerName ?? '',
                            unSupportReceiveAddressDifferent:
                              quoteResultFinal?.unSupportReceiveAddressDifferent,
                            fromToken: preSwapDataFinal?.fromToken,
                            toToken: preSwapDataFinal?.toToken,
                            quoteId: quoteResultFinal?.quoteId ?? '',
                            amount: approveAmount,
                            toAmount: preSwapDataFinal?.toTokenAmount ?? '',
                            useAddress: fromUserAddress ?? '',
                            spenderAddress:
                              preSwapDataFinal?.allowanceResult
                                ?.allowanceTarget ?? '',
                            status: ESwapApproveTransactionStatus.PENDING,
                            kind: quoteResultFinal?.kind ?? ESwapQuoteKind.SELL,
                            resetApproveIsMax: !!swapActionState.approveUnLimit,
                          },
                        };
                      }
                      return pre;
                    });
                  }
                  break;
                }
              } else if (type === ESwapStepType.WRAP_TX) {
                await wrappedTx(
                  stepIndex,
                  quoteResultFinal,
                  preSwapDataFinal?.fromToken,
                  preSwapDataFinal?.toToken,
                  preSwapDataFinal?.needFetchGas,
                );
              } else if (type === ESwapStepType.SEND_TX) {
                await buildTxNew(
                  stepIndex,
                  preSwapDataFinal?.fromToken,
                  preSwapDataFinal?.toToken,
                  quoteResultFinal,
                  undefined,
                  preSwapDataFinal?.shouldFallback,
                  undefined,
                  preSwapDataFinal?.needFetchGas,
                );
              } else if (type === ESwapStepType.SIGN_MESSAGE) {
                await signMessage(
                  stepIndex,
                  preSwapDataFinal?.fromToken,
                  preSwapDataFinal?.toToken,
                  quoteResultFinal,
                  preSwapDataFinal?.needFetchGas,
                );
              } else if (type === ESwapStepType.BATCH_APPROVE_SWAP) {
                await batchApproveSwap(
                  stepIndex,
                  preSwapDataFinal?.fromToken,
                  preSwapDataFinal?.toToken,
                  quoteResultFinal,
                  preSwapDataFinal?.shouldFallback,
                  preSwapDataFinal?.needFetchGas,
                );
              }

              if (
                i !== swapStepsValuesFinal.length - 1 &&
                !preSwapDataFinal?.shouldFallback
              ) {
                setSwapSteps(
                  (prevSteps: {
                    steps: ISwapStep[];
                    preSwapData: ISwapPreSwapData;
                    quoteResult?: IFetchQuoteResult | undefined;
                  }) => {
                    const newSteps = [...prevSteps.steps];
                    newSteps[i] = {
                      ...newSteps[i],
                      status: ESwapStepStatus.SUCCESS,
                    };
                    return {
                      ...prevSteps,
                      steps: newSteps,
                    };
                  },
                );
              }
            } catch (error: any) {
              const shouldFallback =
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                error?.name !== EOneKeyErrorClassNames.OneKeyAppError &&
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                error?.name !== EOneKeyErrorClassNames.OneKeyHardwareError &&
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                error?.className !==
                  EOneKeyErrorClassNames.OneKeyHardwareError &&
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                !error?.$isHardwareError &&
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                error?.key !== 'global.cancel' &&
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                error?.code !== 803 &&
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                error?.code !== -99_999 &&
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                !error?.message?.toLowerCase()?.includes('reject') &&
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                step.type !== ESwapStepType.SIGN_MESSAGE &&
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                error?.name !== 'buildSwapApi';
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              let errorMessage = error?.message ?? 'Unknown error';
              if (shouldFallback) {
                errorMessage = undefined;
              }
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              if (error?.key === 'global.cancel') {
                errorMessage = intl.formatMessage({
                  id: ETranslations.limit_cancel_order_title,
                });
              }
              let fallbackSwapStepsValues: {
                steps: ISwapStep[];
                preSwapData: ISwapPreSwapData;
                quoteResult?: IFetchQuoteResult | undefined;
              } = {
                steps: swapStepsRef.current.steps,
                preSwapData: swapStepsRef.current.preSwapData,
                quoteResult: swapStepsRef.current.quoteResult,
              };
              if (shouldFallback) {
                const newSteps = [...fallbackSwapStepsValues.steps];
                newSteps[i] = {
                  ...newSteps[i],
                  status: ESwapStepStatus.READY,
                };
                fallbackSwapStepsValues = {
                  steps: [...newSteps],
                  preSwapData: {
                    ...fallbackSwapStepsValues.preSwapData,
                    shouldFallback,
                  },
                  quoteResult: fallbackSwapStepsValues.quoteResult,
                };
              }
              setSwapSteps(
                (prevSteps: {
                  steps: ISwapStep[];
                  preSwapData: ISwapPreSwapData;
                  quoteResult?: IFetchQuoteResult | undefined;
                }) => {
                  const newSteps = [...prevSteps.steps];
                  newSteps[i] = {
                    ...newSteps[i],
                    status: shouldFallback
                      ? ESwapStepStatus.READY
                      : ESwapStepStatus.FAILED,
                    errorMessage,
                  };
                  return {
                    ...prevSteps,
                    steps: newSteps,
                    preSwapData: {
                      ...prevSteps.preSwapData,
                      shouldFallback,
                    },
                  };
                },
              );
              if (
                shouldFallback &&
                !swapStepsValues?.preSwapData.shouldFallback
              ) {
                void preSwapStepsStart(fallbackSwapStepsValues);
              } else if (
                accountUtils.isQrAccount({
                  accountId: fromAccountId ?? '',
                }) &&
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                error?.key !== 'global.cancel'
              ) {
                void goBackQrCodeModal();
              }
              break;
            }
          }
        }
      }
    },
    [
      goBackQrCodeModal,
      swapSteps.steps,
      swapSteps.preSwapData,
      swapSteps.quoteResult,
      setSwapSteps,
      approveTxNew,
      swapActionState.approveUnLimit,
      intl,
      setInAppNotificationAtom,
      swapTypeSwitch,
      fromUserAddress,
      fromAccountId,
      wrappedTx,
      buildTxNew,
      signMessage,
      batchApproveSwap,
    ],
  );

  return { preSwapStepsStart, cancelLimitOrder, preSwapBeforeStepActions };
}
