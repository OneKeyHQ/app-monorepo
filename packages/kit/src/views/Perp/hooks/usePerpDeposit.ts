import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import type { IEncodedTx, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type { IPerpsDepositToken } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IApproveInfo,
  IBuildUnsignedTxParams,
  ITransferInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { BATCH_SEND_TXS_FEE_UP_RATIO_FOR_SWAP } from '@onekeyhq/shared/src/consts/walletConsts';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';
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
  EProtocolOfExchange,
  type IPerpDepositQuoteRes,
  type ISwapGasInfo,
  type ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';
import type { ISendTxBaseParams } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

const usePerpDeposit = (
  amount: string,
  token: IPerpsDepositToken,
  accountId: string,
) => {
  const [perpDepositQuote, setPerpDepositQuote] = useState<
    IPerpDepositQuoteRes | undefined
  >();
  const intl = useIntl();
  const [perpDepositActionLoading, setPerpDepositActionLoading] =
    useState(false);

  const [perpDepositQuoteLoading, setPerpDepositQuoteLoading] = useState(false);
  const { result } = usePromiseResult(
    async () => {
      if (accountId) {
        const fromTokenAccount =
          await backgroundApiProxy.serviceAccount.getAccount({
            accountId,
            networkId: token.networkId,
          });
        const perpAccount = await backgroundApiProxy.serviceAccount.getAccount({
          accountId,
          networkId: PERPS_NETWORK_ID,
        });
        console.log('perp__fromTokenAccount', fromTokenAccount);
        console.log('perp__Account', perpAccount);
        return {
          fromUserAddress: fromTokenAccount.address,
          perpReceiverAddress: perpAccount.address,
        };
      }
    },
    [accountId, token.networkId],
    {
      watchLoading: true,
    },
  );

  useEffect(() => {
    void (async () => {
      if (result?.fromUserAddress && result?.perpReceiverAddress) {
        setPerpDepositQuoteLoading(true);
        const quoteRes =
          await backgroundApiProxy.serviceSwap.fetchPerpDepositQuote({
            fromNetworkId: token.networkId,
            fromTokenAmount: amount,
            fromTokenAddress: token.contractAddress,
            userAddress: result.fromUserAddress,
            receivingAddress: result.perpReceiverAddress,
          });
        setPerpDepositQuote(quoteRes);
        setPerpDepositQuoteLoading(false);
      }
    })();
  }, [
    amount,
    result?.fromUserAddress,
    result?.perpReceiverAddress,
    token.contractAddress,
    token.networkId,
  ]);

  const buildQuoteRes = useCallback(
    async (buildSwapRes: IPerpDepositQuoteRes) => {
      let transferInfo: ITransferInfo | undefined;
      let encodedTx: IEncodedTx | undefined;
      let swapInfo: ISwapTxInfo | undefined;
      if (buildSwapRes.tx) {
        transferInfo = undefined;
        if (typeof buildSwapRes.tx !== 'string' && buildSwapRes.tx.data) {
          const valueHex = toBigIntHex(
            new BigNumber(buildSwapRes.tx.value ?? 0),
          );
          encodedTx = {
            ...buildSwapRes?.tx,
            value: valueHex,
            from: result?.fromUserAddress ?? '',
          };
        } else {
          encodedTx = buildSwapRes.tx as string;
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
        token.networkId &&
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
      token.networkId,
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

  const buildPerpDepositTx = useCallback(async () => {
    if (!perpDepositQuote) {
      throw new OneKeyError('perpDepositQuote is not found');
    }
    setPerpDepositActionLoading(true);
    const { transferInfo, encodedTx, swapInfo } = await buildQuoteRes(
      perpDepositQuote,
    );
    const { unsignedTxArr } = await getApproveUnSignedTxArr(perpDepositQuote);
    const gasFeeInfos = await estimateNetworkFee(
      {
        networkId: token.networkId,
        accountId,
        transfersInfo: transferInfo ? [transferInfo] : undefined,
        encodedTx,
        swapInfo,
      },
      unsignedTxArr,
    );
    setPerpDepositActionLoading(false);
    // todo send tx
  }, [
    perpDepositQuote,
    buildQuoteRes,
    getApproveUnSignedTxArr,
    estimateNetworkFee,
    token.networkId,
    accountId,
  ]);

  const shouldSignEveryTime = useMemo(() => {
    const isExternalAccount = accountUtils.isExternalAccount({
      accountId: accountId ?? '',
    });
    const isHDAccount = accountUtils.isHwOrQrAccount({
      accountId: accountId ?? '',
    });
    const isShouldApprove = Boolean(perpDepositQuote?.allowanceResult);
    return (isExternalAccount || isHDAccount) && isShouldApprove;
  }, [perpDepositQuote?.allowanceResult, accountId]);

  const multipleStepTest = useMemo(() => {
    if (!perpDepositQuote?.allowanceResult || !shouldSignEveryTime) {
      return '';
    }
    return intl.formatMessage({
      id: perpDepositQuote?.allowanceResult?.shouldResetApprove
        ? ETranslations.swap_review_confirm_3_on_device
        : ETranslations.swap_review_confirm_2_on_device,
    });
  }, [perpDepositQuote?.allowanceResult, intl, shouldSignEveryTime]);

  return {
    perpDepositQuote,
    perpDepositQuoteLoading,
    shouldApprove: !!perpDepositQuote?.allowanceResult,
    multipleStepTest,
    perpDepositActionLoading,
    buildPerpDepositTx,
  };
};

export default usePerpDeposit;
