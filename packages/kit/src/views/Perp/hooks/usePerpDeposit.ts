import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isEqual, isNil } from 'lodash';
import { useIntl } from 'react-intl';

import { Toast, rootNavigationRef } from '@onekeyhq/components';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import {
  type IPerpsDepositToken,
  usePerpsDepositOrderAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IApproveInfo,
  IBuildUnsignedTxParams,
  ITransferInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { BATCH_SEND_TXS_FEE_UP_RATIO_FOR_SWAP } from '@onekeyhq/shared/src/consts/walletConsts';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EScanQrCodeModalPages } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { calculateFeeForSend } from '@onekeyhq/shared/src/utils/feeUtils';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
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
import { USDC_TOKEN_INFO } from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import { ESendPreCheckTimingEnum } from '@onekeyhq/shared/types/send';
import {
  EProtocolOfExchange,
  ESwapFetchCancelCause,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';
import type {
  IPerpDepositQuoteRes,
  IPerpDepositQuoteResponse,
  ISwapGasInfo,
  ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';
import type { ISendTxBaseParams } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

export const usePerpDepositOrder = ({
  accountId,
  indexedAccountId,
}: {
  accountId?: string | null;
  indexedAccountId?: string | null;
}) => {
  const [{ orders: perpDepositOrder }] = usePerpsDepositOrderAtom();

  const filterPerpDepositOrder = useMemo(() => {
    return perpDepositOrder.filter((item) => {
      return (
        ((!item.accountId && !accountId) || item.accountId === accountId) &&
        ((!item.indexedAccountId && !indexedAccountId) ||
          item.indexedAccountId === indexedAccountId)
      );
    });
  }, [perpDepositOrder, accountId, indexedAccountId]);

  useEffect(() => {
    void backgroundApiProxy.serviceSwap.perpDepositOrderFetchLoop({
      accountId,
      indexedAccountId,
    });
  }, [accountId, indexedAccountId]);

  return {
    perpDepositOrder: filterPerpDepositOrder,
  };
};

const usePerpDeposit = (
  amount: string,
  selectedAction: 'withdraw' | 'deposit',
  indexedAccountId?: string,
  selectedAccountId?: string,
  token?: IPerpsDepositToken,
  checkFromTokenFiatValue?: boolean,
  isAvailableBalance?: boolean,
) => {
  const [perpDepositQuote, setPerpDepositQuote] = useState<
    IPerpDepositQuoteResponse | undefined
  >();
  const intl = useIntl();

  const [perpDepositQuoteLoading, setPerpDepositQuoteLoading] = useState(false);
  const [, setPerpDepositOrder] = usePerpsDepositOrderAtom();
  const handlePerpDepositTxSuccess = useCallback(
    ({
      fromAmount,
      toAmount,
      fromToken,
      fromTxId,
      isArbUSDCOrder,
      skipToast,
    }: {
      fromAmount: string;
      toAmount: string;
      fromToken: IPerpsDepositToken;
      fromTxId: string;
      isArbUSDCOrder: boolean;
      skipToast?: boolean;
    }) => {
      if (!skipToast) {
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.feedback_transaction_submitted,
          }),
          message: intl.formatMessage(
            {
              id: ETranslations.perp_toast_deposit_success_msg,
            },
            {
              amount: fromAmount,
              token: fromToken?.symbol,
            },
          ),
        });
      }
      const time = Date.now();
      setPerpDepositOrder((prev) => {
        return {
          orders: [
            ...prev.orders,
            {
              isArbUSDCOrder,
              fromTxId,
              amount: toAmount,
              token: fromToken,
              status: ESwapTxHistoryStatus.PENDING,
              time,
              accountId: selectedAccountId,
              indexedAccountId,
            },
          ],
        };
      });
      setTimeout(() => {
        void backgroundApiProxy.serviceSwap.perpDepositOrderFetchLoop({
          accountId: selectedAccountId,
          indexedAccountId,
        });
      }, 200);
    },
    [indexedAccountId, intl, selectedAccountId, setPerpDepositOrder],
  );
  const isArbitrumUsdcToken = useMemo(() => {
    return equalTokenNoCaseSensitive({
      token1: token,
      token2: {
        networkId: PERPS_NETWORK_ID,
        contractAddress: USDC_TOKEN_INFO.address,
      },
    });
  }, [token]);
  const { result } = usePromiseResult(
    async () => {
      if (
        selectedAction !== 'deposit' ||
        isArbitrumUsdcToken ||
        !checkFromTokenFiatValue
      )
        return;
      if ((indexedAccountId || selectedAccountId) && token?.networkId) {
        const defaultDeriveType =
          await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId: token.networkId ?? '',
          });
        const accountAddressInfo =
          await backgroundApiProxy.serviceAccount.getNetworkAccount({
            indexedAccountId,
            networkId: token.networkId ?? '',
            deriveType: defaultDeriveType ?? 'default',
            accountId: indexedAccountId ? undefined : selectedAccountId ?? '',
          });
        const perpAccountDefaultDeriveType =
          await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId: PERPS_NETWORK_ID,
          });
        const perpAccount =
          await backgroundApiProxy.serviceAccount.getNetworkAccount({
            accountId: indexedAccountId ? undefined : selectedAccountId ?? '',
            indexedAccountId,
            deriveType: perpAccountDefaultDeriveType ?? 'default',
            networkId: PERPS_NETWORK_ID,
          });
        return {
          accountId: accountAddressInfo.id,
          fromUserAddress: accountAddressInfo.addressDetail.address,
          perpReceiverAddress: perpAccount.addressDetail.address,
        };
      }
    },
    [
      selectedAction,
      isArbitrumUsdcToken,
      indexedAccountId,
      token?.networkId,
      checkFromTokenFiatValue,
      selectedAccountId,
    ],
    {
      watchLoading: true,
    },
  );
  const accountId = useMemo(() => {
    return result?.accountId ?? '';
  }, [result?.accountId]);

  const perpDepositQuoteAction = useCallback(async () => {
    const amountBN = new BigNumber(amount ?? '0');
    if (
      selectedAction !== 'deposit' ||
      !token ||
      isArbitrumUsdcToken ||
      !checkFromTokenFiatValue
    ) {
      await backgroundApiProxy.serviceSwap.cancelFetchPerpDepositQuote();
      setPerpDepositQuoteLoading(false);
      setPerpDepositQuote(undefined);
      return;
    }
    try {
      if (
        result?.fromUserAddress &&
        result?.perpReceiverAddress &&
        !amountBN.isZero() &&
        !amountBN.isNaN()
      ) {
        setPerpDepositQuoteLoading(true);
        const quoteRes =
          await backgroundApiProxy.serviceSwap.fetchPerpDepositQuote({
            fromNetworkId: token.networkId,
            fromTokenAmount: amountBN.toFixed(),
            fromTokenAddress: token.contractAddress,
            userAddress: result.fromUserAddress,
            receivingAddress: result.perpReceiverAddress,
          });
        if (quoteRes) {
          setPerpDepositQuote(quoteRes);
        }
        setPerpDepositQuoteLoading(false);
      } else {
        await backgroundApiProxy.serviceSwap.cancelFetchPerpDepositQuote();
        setPerpDepositQuoteLoading(false);
        setPerpDepositQuote(undefined);
      }
    } catch (e: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const cause = e?.cause || e?.data?.cause;
      if (cause !== ESwapFetchCancelCause.SWAP_PERP_DEPOSIT_QUOTE_CANCEL) {
        setPerpDepositQuoteLoading(false);
        setPerpDepositQuote(undefined);
        throw e;
      }
    }
  }, [
    amount,
    selectedAction,
    isArbitrumUsdcToken,
    checkFromTokenFiatValue,
    result?.fromUserAddress,
    result?.perpReceiverAddress,
    token,
  ]);

  useEffect(() => {
    if (isAvailableBalance) {
      void backgroundApiProxy.serviceSwap.cancelFetchPerpDepositQuote();
      setPerpDepositQuoteLoading(false);
      setPerpDepositQuote(undefined);
    } else {
      void perpDepositQuoteAction();
    }
  }, [perpDepositQuoteAction, isAvailableBalance]);

  const buildQuoteRes = useCallback(
    async (buildSwapResponse: IPerpDepositQuoteResponse) => {
      let transferInfo: ITransferInfo | undefined;
      let encodedTx: IEncodedTx | undefined;
      let swapInfo: ISwapTxInfo | undefined;
      const buildSwapRes = buildSwapResponse.result;
      if (buildSwapResponse.tx && token) {
        transferInfo = undefined;
        if (
          typeof buildSwapResponse.tx !== 'string' &&
          buildSwapResponse.tx.data
        ) {
          const valueHex = toBigIntHex(
            new BigNumber(buildSwapResponse.tx.value ?? 0),
          );
          encodedTx = {
            ...buildSwapResponse?.tx,
            value: valueHex,
            from: result?.fromUserAddress ?? '',
          };
        } else {
          encodedTx = buildSwapResponse.tx as string;
        }
        swapInfo = {
          protocol: buildSwapRes.protocol ?? EProtocolOfExchange.SWAP,
          sender: {
            amount: buildSwapRes.fromAmount,
            token,
            accountInfo: {
              accountId,
              networkId: token.networkId,
            },
          },
          receiver: {
            amount: buildSwapRes.toAmount,
            token: buildSwapRes.toTokenInfo,
            accountInfo: {
              accountId,
              networkId: buildSwapRes.toTokenInfo.networkId,
            },
          },
          accountAddress: result?.fromUserAddress ?? '',
          receivingAddress: result?.perpReceiverAddress ?? '',
          swapBuildResData: {
            result: {
              ...buildSwapRes.result,
            },
          },
        };
      }
      return {
        transferInfo,
        encodedTx,
        swapInfo,
      };
    },
    [accountId, result?.fromUserAddress, result?.perpReceiverAddress, token],
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
      const gasLet = gasRes.gas?.[1] ?? gasRes.gas?.[0];
      const gasEIP1559Let = gasRes.gasEIP1559?.[1] ?? gasRes.gasEIP1559?.[0];
      const feeUTXOLet = gasRes.feeUTXO?.[1] ?? gasRes.feeUTXO?.[0];
      const feeTronLet = gasRes.feeTron?.[1] ?? gasRes.feeTron?.[0];
      const feeSolLet = gasRes.feeSol?.[1] ?? gasRes.feeSol?.[0];
      const feeCkbLet = gasRes.feeCkb?.[1] ?? gasRes.feeCkb?.[0];
      const feeAlgoLet = gasRes.feeAlgo?.[1] ?? gasRes.feeAlgo?.[0];
      const feeDotLet = gasRes.feeDot?.[1] ?? gasRes.feeDot?.[0];
      const feeBudgetLet = gasRes.feeBudget?.[1] ?? gasRes.feeBudget?.[0];
      return {
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
    },
    [],
  );

  const getApproveUnsignedTx = useCallback(
    async (
      approveAmount: string,
      data?: IPerpDepositQuoteRes,
      prevNonce?: number,
    ) => {
      if (data?.allowanceResult?.allowanceTarget && result?.fromUserAddress) {
        const approveInfo: IApproveInfo = {
          owner: result?.fromUserAddress ?? '',
          spender: data.allowanceResult.allowanceTarget,
          amount: approveAmount,
          isMax: false,
          tokenInfo: {
            ...data.fromTokenInfo,
            isNative: !!data.fromTokenInfo.isNative,
            address: data.fromTokenInfo.contractAddress,
            name: data.fromTokenInfo.name ?? data.fromTokenInfo.symbol,
          },
          swapApproveRes: data.result,
        };
        if (accountId) {
          const unsignedTx =
            await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
              networkId: data.fromTokenInfo.networkId,
              accountId,
              approveInfo,
              prevNonce,
            });
          return { unsignedTx, approveInfo };
        }
      }
      return { unsignedTx: undefined, approveInfo: undefined };
    },
    [result?.fromUserAddress, accountId],
  );

  const getApproveUnSignedTxArr = useCallback(
    async (data?: IPerpDepositQuoteRes) => {
      let unsignedTxArr: IUnsignedTxPro[] = [];
      if (
        data?.fromTokenInfo &&
        data?.toTokenInfo &&
        data.fromAmount &&
        data?.toAmount &&
        result?.fromUserAddress &&
        result?.perpReceiverAddress &&
        token?.networkId &&
        accountId
      ) {
        let prevNonce: number | undefined;
        if (data.allowanceResult) {
          if (data.allowanceResult.shouldResetApprove) {
            const { unsignedTx: resetApproveUnsignedTx } =
              await getApproveUnsignedTx('0', data);
            if (resetApproveUnsignedTx) {
              unsignedTxArr = [...unsignedTxArr, resetApproveUnsignedTx];
              prevNonce = resetApproveUnsignedTx.nonce;
            }
          }
          const { unsignedTx: approveUnsignedTx } = await getApproveUnsignedTx(
            data.fromAmount,
            data,
            prevNonce,
          );
          if (approveUnsignedTx) {
            unsignedTxArr = [...unsignedTxArr, approveUnsignedTx];
          }
        }
      }
      return {
        unsignedTxArr,
      };
    },
    [
      result?.fromUserAddress,
      result?.perpReceiverAddress,
      token?.networkId,
      accountId,
      getApproveUnsignedTx,
    ],
  );

  const estimateNetworkFee = useCallback(
    async (
      buildUnsignedParams: ISendTxBaseParams & IBuildUnsignedTxParams,
      approveUnsignedTxArr?: IUnsignedTxPro[],
    ) => {
      if (!token || !accountId || !result?.fromUserAddress) {
        throw new OneKeyError('account error');
      }
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
      const vaultSettings =
        await backgroundApiProxy.serviceNetwork.getVaultSettings({
          networkId: token.networkId,
        });
      if (
        approveUnsignedTxArr?.length &&
        approveUnsignedTxArr.length > 0 &&
        vaultSettings.supportBatchEstimateFee?.[token.networkId]
      ) {
        const unsignedTxArr = [...approveUnsignedTxArr, unsignedTx];
        const estimateFeeParamsArr = await Promise.all(
          unsignedTxArr.map((o) =>
            backgroundApiProxy.serviceGas.buildEstimateFeeParams({
              networkId: token.networkId,
              accountId,
              encodedTx: o.encodedTx,
            }),
          ),
        );
        const gasResArr = await backgroundApiProxy.serviceGas.batchEstimateFee({
          networkId: token.networkId,
          accountId,
          encodedTxs: estimateFeeParamsArr.map((o) => o.encodedTx ?? {}),
        });
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
                  allRoutesLength.plus(BATCH_SEND_TXS_FEE_UP_RATIO_FOR_SWAP),
                )
                .toFixed();
            } else {
              specialGasLimit = new BigNumber(baseGasLimit ?? 0)
                .times(BATCH_SEND_TXS_FEE_UP_RATIO_FOR_SWAP)
                .toFixed();
            }
            const lastTxGasInfo = {
              common: lastTxUseGasInfo?.common,
              gas: lastTxUseGasInfo?.gas
                ? {
                    ...lastTxUseGasInfo.gas,
                    gasLimit: specialGasLimit ?? lastTxUseGasInfo.gas.gasLimit,
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
                networkId: token.networkId,
                accountId,
                encodedTx: unsignedTxItem.encodedTx,
              });
            const gasRes = await backgroundApiProxy.serviceGas.estimateFee({
              ...estimateFeeParams,
              accountAddress: result?.fromUserAddress,
              networkId: token.networkId,
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
            networkId: token.networkId,
            accountId,
            encodedTx: unsignedTx.encodedTx,
          });
        const gasRes = await backgroundApiProxy.serviceGas.estimateFee({
          ...estimateFeeParams,
          accountAddress: result?.fromUserAddress,
          networkId: token.networkId,
          accountId,
        });
        const gasParseInfo = buildGasInfo(gasRes, gasRes.common);
        gasFeeInfos = [
          ...gasFeeInfos,
          {
            encodeTx: unsignedTx.encodedTx,
            gasInfo: gasParseInfo,
          },
        ];
      }
      return gasFeeInfos;
    },
    [token, accountId, result?.fromUserAddress, buildGasInfo],
  );

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

  const goBackQrCodeModal = useCallback(() => {
    if (
      rootNavigationRef.current?.canGoBack() &&
      rootNavigationRef.current?.getCurrentRoute()?.name ===
        EScanQrCodeModalPages.ScanQrCodeStack
    ) {
      rootNavigationRef.current?.goBack();
    }
  }, []);

  const onApproveTxSuccess = useCallback(() => {
    if (
      accountUtils.isQrAccount({
        accountId,
      })
    ) {
      goBackQrCodeModal();
    }
  }, [goBackQrCodeModal, accountId]);

  const updateUnsignedTxAndSendTx = useCallback(
    async ({
      unsignedTxItem,
      gasInfo,
    }: {
      networkId: string;
      accountId: string;
      unsignedTxItem: IUnsignedTxPro;
      gasInfo: ISwapGasInfo;
    }) => {
      if (!gasInfo.common) {
        throw new OneKeyError('gasInfo.common is required');
      }
      if (!token?.networkId) {
        throw new OneKeyError('token.networkId is required');
      }
      const updatedUnsignedTxItem =
        await backgroundApiProxy.serviceSend.updateUnsignedTx({
          networkId: token?.networkId,
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
        networkId: token?.networkId,
        accountId,
        unsignedTxs: [updatedUnsignedTxItem],
        precheckTiming: ESendPreCheckTimingEnum.Confirm,
      });
      const { totalNative } = calculateFeeForSend({
        feeInfo: gasInfo as IFeeInfoUnit,
        nativeTokenPrice: gasInfo.common?.nativeTokenPrice ?? 0,
      });
      await backgroundApiProxy.serviceTransaction.verifyTransaction({
        networkId: token?.networkId,
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
        networkId: token.networkId,
        accountId,
        unsignedTx: updatedUnsignedTxItem,
        signOnly: false,
      });
      return res;
    },
    [accountId, token?.networkId],
  );

  const perpSendTxAction = useCallback(
    async (
      buildUnsignedParams: ISendTxBaseParams & IBuildUnsignedTxParams,
      gasInfos: { encodeTx: IEncodedTx; gasInfo: ISwapGasInfo }[],
      approveUnsignedTxArr?: IUnsignedTxPro[],
    ) => {
      if (!token || !accountId || !result?.fromUserAddress) {
        throw new OneKeyError('account error');
      }
      const buildUnsignedParamsCheckNonce = { ...buildUnsignedParams };
      if (approveUnsignedTxArr?.length && approveUnsignedTxArr.length > 0) {
        buildUnsignedParamsCheckNonce.prevNonce =
          approveUnsignedTxArr[approveUnsignedTxArr.length - 1].nonce;
      }
      let lastTxRes: ISignedTxPro | undefined;
      const unsignedTx =
        await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
          ...buildUnsignedParamsCheckNonce,
          isInternalSwap: true,
        });
      const vaultSettings =
        await backgroundApiProxy.serviceNetwork.getVaultSettings({
          networkId: token.networkId,
        });
      if (
        approveUnsignedTxArr?.length &&
        approveUnsignedTxArr.length > 0 &&
        vaultSettings.supportBatchEstimateFee?.[token.networkId]
      ) {
        const unsignedTxArr = [...approveUnsignedTxArr, unsignedTx];
        if (
          unsignedTxArr.every((tx) => findGasInfo(gasInfos ?? [], tx.encodedTx))
        ) {
          for (let i = 0; i < unsignedTxArr.length; i += 1) {
            const unsignedTxItem = unsignedTxArr[i];
            const gasInfoFinal = findGasInfo(
              gasInfos ?? [],
              unsignedTxItem.encodedTx,
            )?.gasInfo;
            if (gasInfoFinal) {
              const res = await updateUnsignedTxAndSendTx({
                networkId: token.networkId,
                accountId,
                unsignedTxItem,
                gasInfo: gasInfoFinal,
              });
              if (i === unsignedTxArr.length - 1) {
                lastTxRes = res;
              } else {
                void onApproveTxSuccess();
              }
            }
          }
        } else {
          const estimateFeeParamsArr = await Promise.all(
            unsignedTxArr.map((o) =>
              backgroundApiProxy.serviceGas.buildEstimateFeeParams({
                networkId: token.networkId,
                accountId,
                encodedTx: o.encodedTx,
              }),
            ),
          );
          const gasResArr =
            await backgroundApiProxy.serviceGas.batchEstimateFee({
              networkId: token.networkId,
              accountId,
              encodedTxs: estimateFeeParamsArr.map((o) => o.encodedTx ?? {}),
            });
          for (let i = 0; i < unsignedTxArr.length; i += 1) {
            const unsignedTxItem = unsignedTxArr[i];
            const gasRes = gasResArr.txFees[i];
            const gasInfo = buildGasInfo(gasRes, gasResArr.common);
            const res = await updateUnsignedTxAndSendTx({
              networkId: token.networkId,
              accountId,
              unsignedTxItem,
              gasInfo,
            });
            if (i === unsignedTxArr.length - 1) {
              lastTxRes = res;
            } else {
              void onApproveTxSuccess();
            }
          }
        }
      } else if (
        approveUnsignedTxArr?.length &&
        approveUnsignedTxArr.length > 0
      ) {
        const unsignedTxArr = [...approveUnsignedTxArr, unsignedTx];
        if (
          unsignedTxArr.every((tx) => findGasInfo(gasInfos ?? [], tx.encodedTx))
        ) {
          for (let i = 0; i < unsignedTxArr.length; i += 1) {
            const unsignedTxItem = unsignedTxArr[i];
            const gasInfoFinal = findGasInfo(
              gasInfos ?? [],
              unsignedTxItem.encodedTx,
            )?.gasInfo;
            if (gasInfoFinal) {
              const res = await updateUnsignedTxAndSendTx({
                networkId: token.networkId,
                accountId,
                unsignedTxItem,
                gasInfo: gasInfoFinal,
              });
              if (i === unsignedTxArr.length - 1) {
                lastTxRes = res;
              } else {
                void onApproveTxSuccess();
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
                    allRoutesLength.plus(BATCH_SEND_TXS_FEE_UP_RATIO_FOR_SWAP),
                  )
                  .toFixed();
              } else {
                specialGasLimit = new BigNumber(baseGasLimit ?? 0)
                  .times(BATCH_SEND_TXS_FEE_UP_RATIO_FOR_SWAP)
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
              lastTxRes = await updateUnsignedTxAndSendTx({
                networkId: token.networkId,
                accountId,
                unsignedTxItem,
                gasInfo: lastTxGasInfo,
              });
            } else {
              const estimateFeeParams =
                await backgroundApiProxy.serviceGas.buildEstimateFeeParams({
                  networkId: token.networkId,
                  accountId,
                  encodedTx: unsignedTxItem.encodedTx,
                });
              const gasRes = await backgroundApiProxy.serviceGas.estimateFee({
                ...estimateFeeParams,
                accountAddress: result?.fromUserAddress,
                networkId: token.networkId,
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
              await updateUnsignedTxAndSendTx({
                networkId: token.networkId,
                accountId,
                unsignedTxItem,
                gasInfo: gasParseInfo,
              });
              void onApproveTxSuccess();
            }
          }
        }
      } else if (findGasInfo(gasInfos ?? [], unsignedTx.encodedTx)) {
        const gasInfoFinal = findGasInfo(
          gasInfos ?? [],
          unsignedTx.encodedTx,
        )?.gasInfo;
        if (gasInfoFinal) {
          lastTxRes = await updateUnsignedTxAndSendTx({
            networkId: token.networkId,
            accountId,
            unsignedTxItem: unsignedTx,
            gasInfo: gasInfoFinal,
          });
        }
      } else {
        const estimateFeeParams =
          await backgroundApiProxy.serviceGas.buildEstimateFeeParams({
            networkId: token.networkId,
            accountId,
            encodedTx: unsignedTx.encodedTx,
          });
        const gasRes = await backgroundApiProxy.serviceGas.estimateFee({
          ...estimateFeeParams,
          accountAddress: result?.fromUserAddress,
          networkId: token.networkId,
          accountId,
        });

        const gasParseInfo = buildGasInfo(gasRes, gasRes.common);
        lastTxRes = await updateUnsignedTxAndSendTx({
          networkId: token.networkId,
          accountId,
          unsignedTxItem: unsignedTx,
          gasInfo: gasParseInfo,
        });
      }
      return lastTxRes;
    },
    [
      accountId,
      buildGasInfo,
      findGasInfo,
      onApproveTxSuccess,
      result?.fromUserAddress,
      token,
      updateUnsignedTxAndSendTx,
    ],
  );

  const buildPerpDepositTx = useCallback(async () => {
    if (!perpDepositQuote) {
      throw new OneKeyError('perpDepositQuote is not found');
    }
    if (!token?.networkId) {
      throw new OneKeyError('token.networkId is required');
    }
    const { transferInfo, encodedTx, swapInfo } = await buildQuoteRes(
      perpDepositQuote,
    );
    const { unsignedTxArr } = await getApproveUnSignedTxArr(
      perpDepositQuote?.result,
    );
    const gasFeeInfos = await estimateNetworkFee(
      {
        networkId: token?.networkId,
        accountId,
        transfersInfo: transferInfo ? [transferInfo] : undefined,
        encodedTx,
        swapInfo,
      },
      unsignedTxArr,
    );
    try {
      const res = await perpSendTxAction(
        {
          networkId: token?.networkId,
          accountId,
          transfersInfo: transferInfo ? [transferInfo] : undefined,
          encodedTx,
          swapInfo,
        },
        gasFeeInfos,
        unsignedTxArr,
      );
      if (res) {
        void handlePerpDepositTxSuccess({
          fromTxId: res.txid,
          isArbUSDCOrder: false,
          fromToken: token,
          toAmount: perpDepositQuote.result.toAmount,
          fromAmount: amount,
        });
        defaultLogger.perp.deposit.perpDepositInitiate({
          userAddress: result?.fromUserAddress ?? '',
          receiverAddress: result?.perpReceiverAddress ?? '',
          token,
          amount,
          toAmount: perpDepositQuote.result.toAmount,
          status: ESwapTxHistoryStatus.SUCCESS,
          txId: res.txid,
        });
      } else {
        defaultLogger.perp.deposit.perpDepositInitiate({
          userAddress: result?.fromUserAddress ?? '',
          receiverAddress: result?.perpReceiverAddress ?? '',
          token,
          amount,
          toAmount: perpDepositQuote.result.toAmount,
          status: ESwapTxHistoryStatus.FAILED,
          errorMessage: 'txid not found',
        });
      }
    } catch (e: any) {
      defaultLogger.perp.deposit.perpDepositInitiate({
        userAddress: result?.fromUserAddress ?? '',
        receiverAddress: result?.perpReceiverAddress ?? '',
        token,
        amount,
        toAmount: perpDepositQuote.result.toAmount,
        status: ESwapTxHistoryStatus.FAILED,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        errorMessage: e?.message ?? '',
      });
    }
  }, [
    perpDepositQuote,
    token,
    buildQuoteRes,
    getApproveUnSignedTxArr,
    estimateNetworkFee,
    accountId,
    perpSendTxAction,
    handlePerpDepositTxSuccess,
    amount,
    result?.fromUserAddress,
    result?.perpReceiverAddress,
  ]);

  const shouldSignEveryTime = useMemo(() => {
    const isExternalAccount = accountUtils.isExternalAccount({
      accountId: accountId ?? '',
    });
    const isHDAccount = accountUtils.isHwOrQrAccount({
      accountId: accountId ?? '',
    });
    const isShouldApprove = Boolean(perpDepositQuote?.result?.allowanceResult);
    return (isExternalAccount || isHDAccount) && isShouldApprove;
  }, [perpDepositQuote?.result?.allowanceResult, accountId]);

  const multipleStepText = useMemo(() => {
    if (!perpDepositQuote?.result?.allowanceResult || !shouldSignEveryTime) {
      return '';
    }
    return intl.formatMessage({
      id: perpDepositQuote?.result?.allowanceResult?.shouldResetApprove
        ? ETranslations.swap_review_confirm_3_on_device
        : ETranslations.swap_review_confirm_2_on_device,
    });
  }, [perpDepositQuote?.result?.allowanceResult, intl, shouldSignEveryTime]);

  const checkRefreshQuote = useMemo(() => {
    if (
      selectedAction === 'deposit' &&
      checkFromTokenFiatValue &&
      !perpDepositQuoteLoading &&
      !isArbitrumUsdcToken
    ) {
      const quoteAmount = perpDepositQuote?.result?.toAmount;
      const quoteAmountBN = new BigNumber(quoteAmount || '0');
      if (quoteAmountBN.isNaN() || quoteAmountBN.lte(0)) {
        return true;
      }
    }
    return false;
  }, [
    perpDepositQuoteLoading,
    selectedAction,
    checkFromTokenFiatValue,
    perpDepositQuote?.result?.toAmount,
    isArbitrumUsdcToken,
  ]);

  return {
    perpDepositQuote,
    perpDepositQuoteLoading,
    shouldApprove: !!perpDepositQuote?.result?.allowanceResult,
    shouldResetApprove:
      perpDepositQuote?.result?.allowanceResult?.shouldResetApprove,
    multipleStepText,
    buildPerpDepositTx,
    isArbitrumUsdcToken,
    checkRefreshQuote,
    perpDepositQuoteAction,
    handlePerpDepositTxSuccess,
  };
};

export default usePerpDeposit;
