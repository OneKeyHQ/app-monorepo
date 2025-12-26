import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isEmpty, isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Badge,
  Dialog,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  XStack,
} from '@onekeyhq/components';
import type { IEncodedTxAptos } from '@onekeyhq/core/src/chains/aptos/types';
import type { IEncodedTxBtc } from '@onekeyhq/core/src/chains/btc/types';
import type { IEncodedTxDot } from '@onekeyhq/core/src/chains/dot/types';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import {
  tronTokenAddressMainnet,
  tronTokenAddressTestnet,
} from '@onekeyhq/core/src/chains/tron/constants';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useCustomFeeAtom,
  useDecodedTxsAtom,
  useExtraFeeInfoAtom,
  useIsSinglePresetAtom,
  useMegafuelEligibleAtom,
  useNativeTokenInfoAtom,
  useNativeTokenTransferAmountToUpdateAtom,
  usePayWithTokenInfoAtom,
  useSendFeeStatusAtom,
  useSendSelectedFeeAtom,
  useSendTxStatusAtom,
  useSignatureConfirmActions,
  useTokenTransferAmountAtom,
  useTronResourceRentalInfoAtom,
  useTxAdvancedSettingsAtom,
  useTxFeeInfoInitAtom,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ITransferPayload } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  BATCH_APPROVE_GAS_FEE_RATIO_FOR_SWAP,
  BATCH_SEND_TXS_FEE_DOWN_RATIO_FOR_TOTAL,
  BATCH_SEND_TXS_FEE_UP_RATIO_FOR_APPROVE,
  BATCH_SEND_TXS_FEE_UP_RATIO_FOR_SWAP,
} from '@onekeyhq/shared/src/consts/walletConsts';
import { IMPL_APTOS } from '@onekeyhq/shared/src/engine/engineConsts';
import type { IOneKeyRpcError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';
import {
  calculateFeeForSend,
  calculateTotalFeeRange,
  getFeeIcon,
  getFeeLabel,
} from '@onekeyhq/shared/src/utils/feeUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { ALGO_TX_MIN_FEE } from '@onekeyhq/shared/types/algo';
import {
  EFeeType,
  ESendFeeStatus,
  ETronResourceRentalPayType,
} from '@onekeyhq/shared/types/fee';
import type {
  IFeeInfoUnit,
  IFeeSelectorItem,
  IMultiTxsFeeSelectorItem,
} from '@onekeyhq/shared/types/fee';

import { TxFeeEditor } from './TxFeeEditor';
import { TxFeeSelectorTrigger } from './TxFeeSelectorTrigger';

type IProps = {
  accountId: string;
  networkId: string;
  useFeeInTx?: boolean;
  feeInfoEditable?: boolean;
  tableLayout?: boolean;
  feeInfoWrapperProps?: React.ComponentProps<typeof Stack>;
  transferPayload?: ITransferPayload;
};

function TxFeeInfo(props: IProps) {
  const {
    accountId,
    networkId,
    useFeeInTx,
    feeInfoEditable = true,
    feeInfoWrapperProps,
    transferPayload,
  } = props;
  const intl = useIntl();
  const feeInTxUpdated = useRef(false);
  const tronRentalUpdated = useRef(false);
  const [sendSelectedFee] = useSendSelectedFeeAtom();
  const [customFee] = useCustomFeeAtom();
  const [settings] = useSettingsPersistAtom();
  const [sendFeeStatus] = useSendFeeStatusAtom();
  const [nativeTokenInfo] = useNativeTokenInfoAtom();
  const [unsignedTxs] = useUnsignedTxsAtom();
  const [isSinglePreset] = useIsSinglePresetAtom();
  const [nativeTokenTransferAmountToUpdate] =
    useNativeTokenTransferAmountToUpdateAtom();
  const [sendTxStatus] = useSendTxStatusAtom();
  const [txAdvancedSettings] = useTxAdvancedSettingsAtom();
  const [extraFeeInfo] = useExtraFeeInfoAtom();
  const [{ decodedTxs }] = useDecodedTxsAtom();
  const [tronResourceRentalInfo] = useTronResourceRentalInfoAtom();
  const [payWithTokenInfo] = usePayWithTokenInfoAtom();
  const [tokenTransferAmount] = useTokenTransferAmountAtom();
  const [megafuelEligible] = useMegafuelEligibleAtom();
  const [txFeeInfoInit] = useTxFeeInfoInitAtom();
  const {
    isResourceRentalNeeded,
    isResourceRentalEnabled,
    payTokenInfo,
    payType,
    isSwapTrxEnabled,
  } = tronResourceRentalInfo;
  const {
    updateSendSelectedFeeInfo,
    updateSendFeeStatus,
    updateSendTxStatus,
    updateCustomFee,
    updateSendSelectedFee,
    updateIsSinglePreset,
    updateTxAdvancedSettings,
    updateTronResourceRentalInfo,
    updatePayWithTokenInfo,
    updateMegafuelEligible,
    updateTxFeeInfoInit,
  } = useSignatureConfirmActions().current;

  const isMultiTxs = unsignedTxs.length > 1;

  // For non-HD wallets, approve&swap transactions will be sent as separate consecutive transactions,
  // each requiring individual confirmation
  // (HD wallets only need to display one transaction confirmation page containing all information)
  // The fee for this swap transaction cannot be estimated via RPC,
  // it must be calculated based on the previous approve transaction fee
  const isLastSwapTxWithFeeInfo = useMemo(
    () =>
      unsignedTxs.length === 1 &&
      unsignedTxs[0].swapInfo &&
      unsignedTxs[0].feeInfo,
    [unsignedTxs],
  );

  const isSingleTxWithFeesInfo = useMemo(
    () => unsignedTxs.length === 1 && unsignedTxs[0].feesInfo,
    [unsignedTxs],
  );

  const isSecondApproveTxWithFeeInfo = useMemo(
    () =>
      unsignedTxs.length === 1 &&
      unsignedTxs[0].approveInfo &&
      unsignedTxs[0].feeInfo,
    [unsignedTxs],
  );

  const { result: [vaultSettings, network, defaultCustomFeeInfo] = [] } =
    usePromiseResult(async () => {
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId,
        networkId,
      });

      if (!account) return;

      return Promise.all([
        backgroundApiProxy.serviceNetwork.getVaultSettings({ networkId }),
        backgroundApiProxy.serviceNetwork.getNetwork({ networkId }),
        backgroundApiProxy.serviceGas.getCustomFeeInfo({ networkId }),
      ]);
    }, [accountId, networkId]);

  const { result, run } = usePromiseResult(
    async () => {
      if (!unsignedTxs || unsignedTxs.length === 0) {
        return {
          r: undefined,
          e: undefined,
          m: undefined,
        };
      }

      try {
        await backgroundApiProxy.serviceGas.abortEstimateFee();

        updateSendFeeStatus({
          status: ESendFeeStatus.Loading,
        });

        if (isMultiTxs) {
          const vs = await backgroundApiProxy.serviceNetwork.getVaultSettings({
            networkId,
          });
          if (vs?.supportBatchEstimateFee?.[networkId]) {
            try {
              const encodedTxList = unsignedTxs.map((tx) => tx.encodedTx);
              const multiTxsFeeResult =
                await backgroundApiProxy.serviceGas.batchEstimateFee({
                  accountId,
                  networkId,
                  encodedTxs: encodedTxList,
                });
              updateSendFeeStatus({
                status: ESendFeeStatus.Success,
                errMessage: '',
              });
              updateTxFeeInfoInit(true);
              return {
                r: undefined,
                e: undefined,
                m: multiTxsFeeResult,
              };
            } catch (e) {
              console.error(e);
              // fallback to single tx estimate fee
            }
          }
        }

        const accountAddress =
          await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
            networkId,
            accountId,
          });

        const { encodedTx, estimateFeeParams: e } =
          await backgroundApiProxy.serviceGas.buildEstimateFeeParams({
            accountId,
            networkId,
            encodedTx: unsignedTxs[0].encodedTx,
          });

        if (isSingleTxWithFeesInfo) {
          const r = unsignedTxs[0].feesInfo;
          updateSendFeeStatus({
            status: ESendFeeStatus.Success,
            errMessage: '',
          });
          updateTxFeeInfoInit(true);
          updateTxAdvancedSettings({ dataChanged: false });
          return {
            r,
            e,
            m: undefined,
          };
        }

        if (
          (isLastSwapTxWithFeeInfo || isSecondApproveTxWithFeeInfo) &&
          unsignedTxs[0].feeInfo
        ) {
          const r = unsignedTxs[0].feeInfo;
          updateSendFeeStatus({
            status: ESendFeeStatus.Success,
            errMessage: '',
          });
          updateTxFeeInfoInit(true);
          updateTxAdvancedSettings({ dataChanged: false });
          return {
            r: {
              ...r,
              gas: r.gas ? [r.gas] : undefined,
              gasEIP1559: r.gasEIP1559 ? [r.gasEIP1559] : undefined,
              feeUTXO: r.feeUTXO ? [r.feeUTXO] : undefined,
              feeTron: r.feeTron ? [r.feeTron] : undefined,
              feeSol: r.feeSol ? [r.feeSol] : undefined,
              feeCkb: r.feeCkb ? [r.feeCkb] : undefined,
              feeAlgo: r.feeAlgo ? [r.feeAlgo] : undefined,
              feeDot: r.feeDot ? [r.feeDot] : undefined,
              feeBudget: r.feeBudget ? [r.feeBudget] : undefined,
              feeNeoN3: r.feeNeoN3 ? [r.feeNeoN3] : undefined,
            },
            e,
          };
        }

        const r = await backgroundApiProxy.serviceGas.estimateFee({
          accountId,
          networkId,
          encodedTx,
          accountAddress,
          transfersInfo: unsignedTxs[0].transfersInfo,
        });

        if (r.megafuelEligible) {
          const customRpcInfo =
            await backgroundApiProxy.serviceCustomRpc.getCustomRpcForNetwork(
              networkId,
            );
          // if custom rpc is enabled, disable megafuel eligible
          if (customRpcInfo?.rpc && customRpcInfo?.enabled) {
            r.megafuelEligible = undefined;
            r.gas = r.gas?.map((gas) => ({
              ...gas,
              gasPrice: gas.originalGasPrice ?? gas.gasPrice,
            }));
            updateMegafuelEligible({
              sponsorable: false,
              sponsorName: '',
            });
          } else {
            updateMegafuelEligible(r.megafuelEligible);
          }
        }

        // if gasEIP1559 returns 5 gas level, then pick the 1st, 3rd and 5th as default gas level
        // these five levels are also provided as predictions on the custom fee page for users to choose
        if (r.gasEIP1559 && r.gasEIP1559.length === 5) {
          r.gasEIP1559 = [r.gasEIP1559[0], r.gasEIP1559[2], r.gasEIP1559[4]];
        } else if (r.gasEIP1559) {
          r.gasEIP1559 = r.gasEIP1559.slice(0, 3);
        }

        // update tron resource rental fee info
        if (r.feeTron && r.feeTron[0]) {
          if (r.feeTron[0].createOrderParams) {
            const {
              createOrderParams,
              saveTRX,
              info,
              payWithUSDT,
              balances,
              tokenPrices,
            } = r.feeTron[0];

            const tokenAddress = network?.isTestnet
              ? tronTokenAddressTestnet[info.payCoinCode]
              : tronTokenAddressMainnet[info.payCoinCode];

            updateTronResourceRentalInfo({
              isResourceRentalNeeded: true,
              isResourceRentalEnabled: tronRentalUpdated.current
                ? undefined
                : true,
              payType: payWithUSDT
                ? ETronResourceRentalPayType.Token
                : ETronResourceRentalPayType.Native,
              payTokenInfo: {
                symbol: info?.payCoinCode ?? '',
                price: tokenPrices[tokenAddress] ?? '0',
                trxRatio: info?.ratio ?? '0',
                exchangeFee: info?.exchangeFee ?? 0,
                payTxFeeAmount: new BigNumber(info?.payCoinAmt ?? 0)
                  .minus(info?.purchaseTRXFee ?? 0)
                  .toFixed(),
                payPurchaseTrxAmount: new BigNumber(
                  info?.purchaseTRXFee ?? 0,
                ).toFixed(),
                extraTrxNum: info?.extraTrxNum ?? 0,
                totalAmount: new BigNumber(info?.payCoinAmt ?? 0).toFixed(),
              },
              saveTRX,
              createOrderParams,
              resourcePrice: {
                price: info.orderPrice,
                minutes: info.pledgeMinute,
              },
            });

            tronRentalUpdated.current = true;

            if (payWithUSDT) {
              updatePayWithTokenInfo({
                address: tokenAddress,
                balance: balances[tokenAddress] ?? '0',
                symbol: info.payCoinCode,
              });
            }
          } else {
            updateTronResourceRentalInfo({
              isResourceRentalNeeded: false,
              isResourceRentalEnabled: false,
              isSwapTrxEnabled: false,
            });
            updatePayWithTokenInfo({
              enabled: false,
              address: '',
              balance: '0',
              logoURI: '',
            });
          }
        }

        updateSendFeeStatus({
          status: ESendFeeStatus.Success,
          errMessage: '',
        });
        updateTxFeeInfoInit(true);
        updateTxAdvancedSettings({ dataChanged: false });
        return {
          r,
          e,
          m: undefined,
        };
      } catch (e) {
        updateTxFeeInfoInit(true);
        updateTxAdvancedSettings({ dataChanged: false });
        updateSendFeeStatus({
          status: ESendFeeStatus.Error,
          errMessage:
            (e as { data: { data: IOneKeyRpcError } }).data?.data?.res?.error
              ?.message ??
            (e as Error).message ??
            e,
        });
      }
    },
    [
      accountId,
      isLastSwapTxWithFeeInfo,
      isMultiTxs,
      isSecondApproveTxWithFeeInfo,
      isSingleTxWithFeesInfo,
      network?.isTestnet,
      networkId,
      unsignedTxs,
      updateMegafuelEligible,
      updatePayWithTokenInfo,
      updateSendFeeStatus,
      updateTronResourceRentalInfo,
      updateTxAdvancedSettings,
      updateTxFeeInfoInit,
    ],
    {
      watchLoading: true,
      pollingInterval: vaultSettings?.estimatedFeePollingInterval
        ? timerUtils.getTimeDurationMs({
            seconds: vaultSettings?.estimatedFeePollingInterval,
          })
        : undefined,
      overrideIsFocused: (isPageFocused) =>
        isPageFocused &&
        sendSelectedFee.feeType !== EFeeType.Custom &&
        !sendTxStatus.isSubmitting,
    },
  );

  const { r: txFee, e: estimateFeeParams, m: multiTxsFee } = result ?? {};

  const txFeeCommon = txFee?.common ?? multiTxsFee?.common;

  const openFeeEditorEnabled =
    !isLastSwapTxWithFeeInfo &&
    !isSecondApproveTxWithFeeInfo &&
    (!!vaultSettings?.editFeeEnabled || !!vaultSettings?.checkFeeDetailEnabled);

  const feeSelectorItems: IFeeSelectorItem[] = useMemo(() => {
    const items = [];
    if (txFee) {
      const feeLength =
        txFee.gasEIP1559?.length ||
        txFee.gas?.length ||
        txFee.feeUTXO?.length ||
        txFee.feeTron?.length ||
        txFee.feeSol?.length ||
        txFee.feeCkb?.length ||
        txFee.feeAlgo?.length ||
        txFee.feeDot?.length ||
        txFee.feeBudget?.length ||
        txFee.feeNeoN3?.length ||
        0;

      for (let i = 0; i < feeLength; i += 1) {
        const feeInfo: IFeeInfoUnit = {
          common: txFee?.common,
          gas: txFee.gas?.[i],
          gasEIP1559: txFee.gasEIP1559?.[i],
          feeUTXO: txFee.feeUTXO?.[i],
          feeTron: txFee.feeTron?.[i],
          feeSol: txFee.feeSol?.[i],
          feeCkb: txFee.feeCkb?.[i],
          feeAlgo: txFee.feeAlgo?.[i],
          feeDot: txFee.feeDot?.[i],
          feeBudget: txFee.feeBudget?.[i],
          feeNeoN3: txFee.feeNeoN3?.[i],
        };

        const useDappFeeAndNotEditFee =
          vaultSettings?.editFeeEnabled && !feeInfoEditable && useFeeInTx;
        if (useDappFeeAndNotEditFee && network) {
          const { tip } = unsignedTxs[0].encodedTx as IEncodedTxDot;
          const feeDecimals = feeInfo.common?.feeDecimals;
          if (feeInfo.feeDot && tip && typeof feeDecimals === 'number') {
            // Only the fee display is affected on sendConfirm page
            feeInfo.feeDot = {
              ...feeInfo.feeDot,
              extraTipInDot: new BigNumber(tip)
                .shiftedBy(-feeDecimals)
                .toFixed(),
            };
          }

          if (
            network &&
            network.impl === IMPL_APTOS &&
            unsignedTxs.length > 0
          ) {
            const { gas_unit_price: aptosGasPrice } = unsignedTxs[0]
              .encodedTx as IEncodedTxAptos;
            // use dApp fee
            if (aptosGasPrice) {
              const gasPrice = chainValueUtils.convertChainValueToGwei({
                value: aptosGasPrice,
                network,
              });

              feeInfo.gas = {
                ...feeInfo.gas,
                gasPrice,
                gasLimit: feeInfo.gas?.gasLimit ?? '1',
              };
            }
          }
        }

        items.push({
          label: intl.formatMessage({
            id: getFeeLabel({
              feeType: EFeeType.Standard,
              presetIndex: i,
              isSinglePreset,
            }),
          }),
          icon: getFeeIcon({
            feeType: EFeeType.Standard,
            presetIndex: i,
            isSinglePreset,
          }),
          value: i,
          feeInfo,
          type: EFeeType.Standard,
        });
      }

      // only have base fee fallback
      if (items.length === 0) {
        items.push({
          label: intl.formatMessage({
            id: getFeeLabel({ feeType: EFeeType.Standard, presetIndex: 0 }),
          }),
          icon: getFeeIcon({ feeType: EFeeType.Standard, presetIndex: 0 }),
          value: 1,
          feeInfo: {
            common: txFee.common,
          },
          type: EFeeType.Standard,
        });
      }

      updateIsSinglePreset(items.length === 1);

      if (vaultSettings?.editFeeEnabled && feeInfoEditable && !isMultiTxs) {
        let customFeeInfo: IFeeInfoUnit = {
          common: txFee.common,
        };

        if (txFee.gas && !isEmpty(txFee.gas)) {
          customFeeInfo.gas = {
            ...(txFee.gas[sendSelectedFee.presetIndex] ?? txFee.gas[0]),
            ...(customFee?.gas ?? {}),
          };
        }

        if (txFee.gasEIP1559 && !isEmpty(txFee.gasEIP1559)) {
          customFeeInfo.gasEIP1559 = {
            ...(txFee.gasEIP1559[sendSelectedFee.presetIndex] ??
              txFee.gasEIP1559[0]),
            ...(customFee?.gasEIP1559 ?? {}),
          };
        }

        if (txFee.feeUTXO && !isEmpty(txFee.feeUTXO)) {
          customFeeInfo.feeUTXO = {
            ...(txFee.feeUTXO[sendSelectedFee.presetIndex] ?? txFee.feeUTXO[0]),
            ...(customFee?.feeUTXO ?? {}),
          };
        }

        if (txFee.feeSol && !isEmpty(txFee.feeSol)) {
          customFeeInfo.feeSol = {
            ...(txFee.feeSol[sendSelectedFee.presetIndex] ?? txFee.feeSol[0]),
            ...(customFee?.feeSol ?? {}),
          };
        }

        if (txFee.feeCkb && !isEmpty(txFee.feeCkb)) {
          customFeeInfo.feeCkb = {
            ...(txFee.feeCkb[sendSelectedFee.presetIndex] ?? txFee.feeCkb[0]),
            ...(customFee?.feeCkb ?? {}),
          };
        }

        if (txFee.feeAlgo && !isEmpty(txFee.feeAlgo)) {
          customFeeInfo.feeAlgo = {
            ...(txFee.feeAlgo[sendSelectedFee.presetIndex] ?? txFee.feeAlgo[0]),
            ...(customFee?.feeAlgo ?? {
              minFee: ALGO_TX_MIN_FEE,
              baseFee: ALGO_TX_MIN_FEE,
            }),
          };
        }

        if (txFee.feeDot && !isEmpty(txFee.feeDot)) {
          customFeeInfo.feeDot = {
            ...(txFee.feeDot[sendSelectedFee.presetIndex] ?? txFee.feeDot[0]),
            ...(customFee?.feeDot ?? { extraTipInDot: '0' }),
          };
        }

        if (txFee.feeBudget && !isEmpty(txFee.feeBudget)) {
          customFeeInfo.feeBudget = {
            ...(txFee.feeBudget[sendSelectedFee.presetIndex] ??
              txFee.feeBudget[0]),
            ...(customFee?.feeBudget ?? {}),
          };
        }

        if (txFee.feeNeoN3 && !isEmpty(txFee.feeNeoN3)) {
          customFeeInfo.feeNeoN3 = {
            ...(txFee.feeNeoN3[sendSelectedFee.presetIndex] ??
              txFee.feeNeoN3[0]),
            ...(customFee?.feeNeoN3 ?? {}),
          };
        }

        if (network && !feeInTxUpdated.current) {
          let originalFeeChanged = false;

          const defaultCustomFeeEnabled =
            defaultCustomFeeInfo?.enabled && defaultCustomFeeInfo?.feeInfo;

          // Saved custom fee has the highest priority
          if (defaultCustomFeeEnabled) {
            customFeeInfo = {
              ...customFeeInfo,
              ...defaultCustomFeeInfo.feeInfo,

              // for gas & gasEIP1559, always use latest gasLimit
              gas: customFeeInfo.gas
                ? {
                    ...customFeeInfo.gas,
                    gasPrice: defaultCustomFeeInfo.feeInfo.gas?.gasPrice ?? '',
                  }
                : undefined,
              gasEIP1559: customFeeInfo.gasEIP1559
                ? {
                    ...customFeeInfo.gasEIP1559,
                    baseFeePerGas:
                      defaultCustomFeeInfo.feeInfo.gasEIP1559?.baseFeePerGas ??
                      customFeeInfo.gasEIP1559?.baseFeePerGas ??
                      '',
                    maxFeePerGas:
                      defaultCustomFeeInfo.feeInfo.gasEIP1559?.maxFeePerGas ??
                      customFeeInfo.gasEIP1559?.maxFeePerGas ??
                      '',
                    maxPriorityFeePerGas:
                      defaultCustomFeeInfo.feeInfo.gasEIP1559
                        ?.maxPriorityFeePerGas ??
                      customFeeInfo.gasEIP1559?.maxPriorityFeePerGas ??
                      '',
                    confidence:
                      defaultCustomFeeInfo.feeInfo.gasEIP1559?.confidence ??
                      customFeeInfo.gasEIP1559?.confidence ??
                      0,
                    gasPrice:
                      defaultCustomFeeInfo.feeInfo.gasEIP1559?.gasPrice ??
                      customFeeInfo.gasEIP1559?.gasPrice ??
                      '',
                  }
                : undefined,

              feeBudget: customFeeInfo.feeBudget
                ? {
                    ...customFeeInfo.feeBudget,
                    gasPrice:
                      defaultCustomFeeInfo.feeInfo.feeBudget?.gasPrice ??
                      customFeeInfo.feeBudget?.gasPrice ??
                      '',
                  }
                : undefined,
            };

            originalFeeChanged = true;
          } else if (useFeeInTx) {
            const selectedFeeResult = calculateTotalFeeRange({
              feeInfo: customFeeInfo,
              txSize: unsignedTxs?.[0]?.txSize ?? 0,
              estimateFeeParams,
            });

            const {
              gas,
              gasLimit,
              gasPrice,
              maxFeePerGas,
              maxPriorityFeePerGas,
            } = unsignedTxs[0].encodedTx as IEncodedTxEvm;

            const limit = gasLimit || gas;
            if (
              maxFeePerGas &&
              maxPriorityFeePerGas &&
              customFeeInfo.gasEIP1559
            ) {
              customFeeInfo.gasEIP1559 = {
                ...customFeeInfo.gasEIP1559,
                maxFeePerGas: chainValueUtils.convertChainValueToGwei({
                  value: maxFeePerGas,
                  network,
                }),
                maxPriorityFeePerGas: chainValueUtils.convertChainValueToGwei({
                  value: maxPriorityFeePerGas,
                  network,
                }),
                gasLimit: limit ?? customFeeInfo.gasEIP1559?.gasLimit,
                gasLimitForDisplay:
                  limit ?? customFeeInfo.gasEIP1559?.gasLimitForDisplay,
              };
              originalFeeChanged = true;
            } else if (gasPrice && customFeeInfo.gas) {
              customFeeInfo.gas = {
                ...customFeeInfo.gas,
                gasPrice: chainValueUtils.convertChainValueToGwei({
                  value: gasPrice,
                  network,
                }),
                gasLimit: limit ?? customFeeInfo.gas?.gasLimit,
                gasLimitForDisplay:
                  limit ?? customFeeInfo.gas?.gasLimitForDisplay,
              };
              originalFeeChanged = true;
            } else if (limit) {
              if (customFeeInfo.gasEIP1559) {
                customFeeInfo.gasEIP1559 = {
                  ...customFeeInfo.gasEIP1559,
                  gasLimit: limit,
                  gasLimitForDisplay: limit,
                };
                originalFeeChanged = true;
              }
              if (customFeeInfo.gas) {
                customFeeInfo.gas = {
                  ...customFeeInfo.gas,
                  gasLimit: limit,
                  gasLimitForDisplay: limit,
                };
                originalFeeChanged = true;
              }
            }

            const dappFeeResult = calculateTotalFeeRange({
              feeInfo: customFeeInfo,
              txSize: unsignedTxs?.[0]?.txSize ?? 0,
              estimateFeeParams,
            });

            console.log('selectedFeeResult >>>>>>>>>>>>>', selectedFeeResult);
            console.log('dappFeeResult >>>>>>>>>>>>>', dappFeeResult);

            if (new BigNumber(dappFeeResult.max).gte(selectedFeeResult.max)) {
              originalFeeChanged = false;
            }
          }

          if (originalFeeChanged) {
            updateSendSelectedFee({
              feeType: EFeeType.Custom,
              presetIndex: 0,
              source:
                useFeeInTx && !defaultCustomFeeEnabled ? 'dapp' : 'wallet',
            });
            updateCustomFee(customFeeInfo);
          }

          feeInTxUpdated.current = true;
        }

        items.push({
          label: intl.formatMessage({
            id: getFeeLabel({ feeType: EFeeType.Custom }),
          }),
          icon: getFeeIcon({ feeType: EFeeType.Custom }),
          value: items.length,
          feeInfo: customFeeInfo,
          type: EFeeType.Custom,
        });
      }

      if (
        vaultSettings?.editFeeEnabled &&
        useFeeInTx &&
        !feeInfoEditable &&
        !isMultiTxs
      ) {
        const customFeeInfo: IFeeInfoUnit = {
          common: txFee.common,
        };

        if (txFee.feeUTXO && !isEmpty(txFee.feeUTXO)) {
          customFeeInfo.feeUTXO = {
            ...txFee.feeUTXO[sendSelectedFee.presetIndex],
            ...(customFee?.feeUTXO ?? {}),
          };
        }

        if (!feeInTxUpdated.current) {
          const { fee } = unsignedTxs[0].encodedTx as IEncodedTxBtc;

          if (txFee.feeUTXO && fee) {
            customFeeInfo.feeUTXO = {
              feeValue: fee,
            };

            updateSendSelectedFee({
              feeType: EFeeType.Custom,
              presetIndex: 0,
              source: 'dapp',
            });

            updateCustomFee(customFeeInfo);
          }

          feeInTxUpdated.current = true;
        }

        items.push({
          label: intl.formatMessage({
            id: getFeeLabel({ feeType: EFeeType.Custom }),
          }),
          icon: getFeeIcon({ feeType: EFeeType.Custom }),
          value: items.length,
          feeInfo: customFeeInfo,
          type: EFeeType.Custom,
        });
      }

      return items;
    }

    return [];
  }, [
    txFee,
    updateIsSinglePreset,
    vaultSettings?.editFeeEnabled,
    feeInfoEditable,
    isMultiTxs,
    useFeeInTx,
    network,
    intl,
    isSinglePreset,
    unsignedTxs,
    sendSelectedFee.presetIndex,
    customFee?.gas,
    customFee?.gasEIP1559,
    customFee?.feeUTXO,
    customFee?.feeSol,
    customFee?.feeCkb,
    customFee?.feeAlgo,
    customFee?.feeDot,
    customFee?.feeBudget,
    customFee?.feeNeoN3,
    defaultCustomFeeInfo?.enabled,
    defaultCustomFeeInfo?.feeInfo,
    estimateFeeParams,
    updateSendSelectedFee,
    updateCustomFee,
  ]);

  const multiTxsFeeSelectorItems: IMultiTxsFeeSelectorItem[] = useMemo(() => {
    const items = [];

    if (multiTxsFee) {
      const feeItem = multiTxsFee.txFees[0];
      const feeLength = feeItem.gasEIP1559?.length || feeItem.gas?.length || 0;

      for (let i = 0; i < feeLength; i += 1) {
        const feeInfos: IFeeInfoUnit[] = multiTxsFee.txFees.map((fee) => ({
          common: multiTxsFee.common,
          gas: fee.gas?.[i],
          gasEIP1559: fee.gasEIP1559?.[i],
        }));

        items.push({
          label: intl.formatMessage({
            id: getFeeLabel({
              feeType: EFeeType.Standard,
              presetIndex: i,
              isSinglePreset,
            }),
          }),
          icon: getFeeIcon({
            feeType: EFeeType.Standard,
            presetIndex: i,
            isSinglePreset,
          }),
          value: i,
          feeInfos,
          type: EFeeType.Standard,
        });
      }

      updateIsSinglePreset(items.length === 1);

      return items;
    }

    return [];
  }, [multiTxsFee, updateIsSinglePreset, intl, isSinglePreset]);

  const { selectedFee } = useMemo(() => {
    let selectedFeeInfos: IFeeInfoUnit[] = [];

    if (isEmpty(feeSelectorItems) && isEmpty(multiTxsFeeSelectorItems))
      return {};

    if (!isEmpty(multiTxsFeeSelectorItems)) {
      if (sendSelectedFee.feeType === EFeeType.Custom) {
        selectedFeeInfos =
          multiTxsFeeSelectorItems[multiTxsFeeSelectorItems.length - 1]
            .feeInfos;
      } else {
        let feeSelectorItem =
          multiTxsFeeSelectorItems[sendSelectedFee.presetIndex] ??
          multiTxsFeeSelectorItems[0];
        if (feeSelectorItem.type === EFeeType.Custom) {
          feeSelectorItem = multiTxsFeeSelectorItems[0];
        }
        selectedFeeInfos = feeSelectorItem.feeInfos;
      }
    } else if (sendSelectedFee.feeType === EFeeType.Custom) {
      selectedFeeInfos = [
        feeSelectorItems[feeSelectorItems.length - 1].feeInfo,
      ];
    } else {
      let feeSelectorItem =
        feeSelectorItems[sendSelectedFee.presetIndex] ?? feeSelectorItems[0];
      if (feeSelectorItem.type === EFeeType.Custom) {
        feeSelectorItem = feeSelectorItems[0];
      }
      selectedFeeInfos = [feeSelectorItem.feeInfo];
    }

    const feeInfos: {
      feeInfo: IFeeInfoUnit;
      total: string;
      totalMin: string;
      totalNative: string;
      totalNativeMin: string;
      totalFiat: string;
      totalFiatMin: string;
      totalNativeForDisplay: string;
      totalFiatForDisplay: string;
      totalNativeMinForDisplay: string;
      totalFiatMinForDisplay: string;
      originalTotalNative?: string;
      originalTotalFiat?: string;
    }[] = [];

    let baseGasLimit =
      selectedFeeInfos[0].gas?.gasLimit ??
      selectedFeeInfos[0].gasEIP1559?.gasLimit;

    let total = new BigNumber(0);
    let totalMin = new BigNumber(0);
    let totalNative = new BigNumber(0);
    let totalNativeMin = new BigNumber(0);
    let totalFiat = new BigNumber(0);
    let totalFiatMin = new BigNumber(0);
    let totalNativeForDisplay = new BigNumber(0);
    let totalNativeMinForDisplay = new BigNumber(0);
    let totalFiatForDisplay = new BigNumber(0);
    let totalFiatMinForDisplay = new BigNumber(0);
    let originalTotalNative = new BigNumber(0);
    let originalTotalFiat = new BigNumber(0);

    for (let i = 0; i < unsignedTxs.length; i += 1) {
      const selectedFeeInfo = selectedFeeInfos[i];

      const unsignedTx = unsignedTxs[i];
      let specialGasLimit: string | undefined;

      // build second approve tx fee info base on first approve fee info
      if (
        !selectedFeeInfo &&
        ((isMultiTxs && unsignedTx.approveInfo && i !== 0) ||
          isSecondApproveTxWithFeeInfo)
      ) {
        specialGasLimit = new BigNumber(baseGasLimit ?? 0)
          .times(BATCH_SEND_TXS_FEE_UP_RATIO_FOR_APPROVE)
          .toFixed();
        baseGasLimit = specialGasLimit;
      }
      // build swap tx fee info base on first approve fee info
      else if (
        (isLastSwapTxWithFeeInfo || !selectedFeeInfo) &&
        (isLastSwapTxWithFeeInfo || isMultiTxs) &&
        unsignedTx.swapInfo &&
        (selectedFeeInfos[0].gas || selectedFeeInfos[0].gasEIP1559)
      ) {
        const swapInfo = unsignedTx.swapInfo;
        const internalSwapGasLimit = swapInfo.swapBuildResData.result.gasLimit;
        const internalSwapRoutes = swapInfo.swapBuildResData.result.routesData;

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
            .times(BATCH_SEND_TXS_FEE_UP_RATIO_FOR_SWAP)
            .plus(BATCH_APPROVE_GAS_FEE_RATIO_FOR_SWAP)
            .toFixed();
        }
      }

      const baseSelectedFeeInfo = selectedFeeInfo ?? selectedFeeInfos[0];

      const txFeeInfo = {
        ...baseSelectedFeeInfo,
        gas: baseSelectedFeeInfo.gas
          ? {
              ...baseSelectedFeeInfo.gas,
              gasLimit: specialGasLimit ?? baseSelectedFeeInfo.gas?.gasLimit,
              gasLimitForDisplay:
                specialGasLimit ?? baseSelectedFeeInfo.gas?.gasLimitForDisplay,
            }
          : undefined,
        gasEIP1559: baseSelectedFeeInfo.gasEIP1559
          ? {
              ...baseSelectedFeeInfo.gasEIP1559,
              gasLimit:
                specialGasLimit ?? baseSelectedFeeInfo.gasEIP1559?.gasLimit,
              gasLimitForDisplay:
                specialGasLimit ??
                baseSelectedFeeInfo.gasEIP1559?.gasLimitForDisplay,
            }
          : undefined,
      };

      const feeResult = calculateFeeForSend({
        feeInfo: txFeeInfo,
        nativeTokenPrice: txFeeCommon?.nativeTokenPrice ?? 0,
        txSize: unsignedTx.txSize,
        estimateFeeParams,
      });

      total = total.plus(feeResult.total);
      totalMin = totalMin.plus(feeResult.totalMin);
      totalNative = totalNative.plus(feeResult.totalNative);
      totalNativeMin = totalNativeMin.plus(feeResult.totalNativeMin);
      totalFiat = totalFiat.plus(feeResult.totalFiat);
      totalFiatMin = totalFiatMin.plus(feeResult.totalFiatMin);
      totalNativeForDisplay = totalNativeForDisplay.plus(
        feeResult.totalNativeForDisplay,
      );
      totalNativeMinForDisplay = totalNativeMinForDisplay.plus(
        feeResult.totalNativeMinForDisplay,
      );
      totalFiatForDisplay = totalFiatForDisplay.plus(
        feeResult.totalFiatForDisplay,
      );
      totalFiatMinForDisplay = totalFiatMinForDisplay.plus(
        feeResult.totalFiatMinForDisplay,
      );

      if (feeResult.originalTotalNative) {
        originalTotalNative = originalTotalNative.plus(
          feeResult.originalTotalNative,
        );
      }

      if (feeResult.originalTotalFiat) {
        originalTotalFiat = originalTotalFiat.plus(feeResult.originalTotalFiat);
      }

      feeInfos.push({
        feeInfo: txFeeInfo,
        total: feeResult.total,
        totalMin: feeResult.totalMin,
        totalNative: feeResult.totalNative,
        totalNativeMin: feeResult.totalNativeMin,
        totalNativeMinForDisplay: feeResult.totalNativeMinForDisplay,
        totalFiat: feeResult.totalFiat,
        totalFiatMin: feeResult.totalFiatMin,
        totalFiatMinForDisplay: feeResult.totalFiatMinForDisplay,
        totalNativeForDisplay: feeResult.totalNativeForDisplay,
        totalFiatForDisplay: feeResult.totalFiatForDisplay,
        originalTotalNative: feeResult.originalTotalNative,
        originalTotalFiat: feeResult.originalTotalFiat,
      });
    }

    // Due to the tendency to use higher fee estimates for approve&swap multi-txs to ensure success,
    // we adjust the displayed fee to be closer to the actual on-chain cost for the user
    if (
      isEmpty(multiTxsFeeSelectorItems) &&
      isMultiTxs &&
      unsignedTxs.some((tx) => tx.approveInfo) &&
      unsignedTxs.some((tx) => tx.swapInfo)
    ) {
      totalNativeForDisplay = totalNativeForDisplay.times(
        BATCH_SEND_TXS_FEE_DOWN_RATIO_FOR_TOTAL,
      );
      totalFiatForDisplay = totalFiatForDisplay.times(
        BATCH_SEND_TXS_FEE_DOWN_RATIO_FOR_TOTAL,
      );
    }

    return {
      selectedFee: {
        feeInfos,
        total: total.toFixed(),
        totalMin: totalMin.toFixed(),
        totalNative: totalNative.toFixed(),
        totalNativeMin: totalNativeMin.toFixed(),
        totalFiat: totalFiat.toFixed(),
        totalFiatMin: totalFiatMin.toFixed(),
        totalNativeForDisplay: totalNativeForDisplay.toFixed(),
        totalNativeMinForDisplay: totalNativeMinForDisplay.toFixed(),
        totalFiatForDisplay: totalFiatForDisplay.toFixed(),
        totalFiatMinForDisplay: totalFiatMinForDisplay.toFixed(),
        originalTotalNative: originalTotalNative.toFixed(),
        originalTotalFiat: originalTotalFiat.toFixed(),
      },
    };
  }, [
    estimateFeeParams,
    feeSelectorItems,
    isLastSwapTxWithFeeInfo,
    isMultiTxs,
    isSecondApproveTxWithFeeInfo,
    multiTxsFeeSelectorItems,
    sendSelectedFee.feeType,
    sendSelectedFee.presetIndex,
    txFeeCommon?.nativeTokenPrice,
    unsignedTxs,
  ]);

  const handleApplyFeeInfo = useCallback(
    ({
      feeType,
      presetIndex,
      customFeeInfo,
      source,
    }: {
      feeType: EFeeType;
      presetIndex: number;
      customFeeInfo: IFeeInfoUnit;
      source?: 'dapp' | 'wallet';
    }) => {
      if (feeType === EFeeType.Custom) {
        updateSendSelectedFee({
          feeType: EFeeType.Custom,
          presetIndex: 0,
          source,
        });
        updateCustomFee(customFeeInfo);
      } else {
        updateSendSelectedFee({
          feeType,
          presetIndex,
        });
        void backgroundApiProxy.serviceGas.updateFeePresetIndex({
          networkId,
          presetIndex,
        });
      }
    },
    [networkId, updateCustomFee, updateSendSelectedFee],
  );

  useEffect(() => {
    if (selectedFee && !isEmpty(selectedFee.feeInfos)) {
      updateSendSelectedFeeInfo(selectedFee);
    }
  }, [selectedFee, updateSendSelectedFeeInfo]);

  useEffect(() => {
    if (!isNil(vaultSettings?.defaultFeePresetIndex)) {
      updateSendSelectedFee({
        presetIndex: vaultSettings?.defaultFeePresetIndex,
      });
    }
  }, [networkId, updateSendSelectedFee, vaultSettings?.defaultFeePresetIndex]);

  useEffect(() => {
    if (!txFeeInfoInit) return;

    if (payWithTokenInfo.enabled) {
      let requiredTokenBalance = new BigNumber(tokenTransferAmount ?? 0);

      if (
        isResourceRentalNeeded &&
        isResourceRentalEnabled &&
        payType === ETronResourceRentalPayType.Token
      ) {
        if (isSwapTrxEnabled) {
          requiredTokenBalance = requiredTokenBalance.plus(
            payTokenInfo?.totalAmount ?? 0,
          );
        } else {
          requiredTokenBalance = requiredTokenBalance.plus(
            payTokenInfo?.payTxFeeAmount ?? 0,
          );
        }
      }

      const isInsufficientTokenBalance = requiredTokenBalance.gt(
        payWithTokenInfo.balance ?? 0,
      );

      const fillUpTokenBalance = requiredTokenBalance.minus(
        payWithTokenInfo.balance ?? 0,
      );

      updateSendTxStatus({
        isInsufficientNativeBalance: false,
        isInsufficientTokenBalance,
        fillUpTokenBalance: fillUpTokenBalance
          .sd(4, BigNumber.ROUND_UP)
          .toFixed(),
      });
    } else {
      if (nativeTokenInfo.isLoading || !nativeTokenInfo) return;

      let totalFeeNative = selectedFee?.totalNative;

      if (
        isResourceRentalNeeded &&
        isResourceRentalEnabled &&
        payType === ETronResourceRentalPayType.Native
      ) {
        totalFeeNative = payTokenInfo?.totalAmount;
      }

      const requiredNativeBalance = new BigNumber(
        nativeTokenTransferAmountToUpdate.amountToUpdate ?? 0,
      )
        .plus(totalFeeNative ?? 0)
        .plus(extraFeeInfo.feeNative ?? 0);

      const fillUpNativeBalance = requiredNativeBalance.minus(
        nativeTokenInfo.balance ?? 0,
      );

      const decodedTx = decodedTxs[0];

      let isInsufficientNativeBalance =
        nativeTokenTransferAmountToUpdate.isMaxSend
          ? false
          : requiredNativeBalance.gt(nativeTokenInfo.balance ?? 0);

      if (decodedTx && decodedTx.isPsbt) {
        isInsufficientNativeBalance = false;
      }

      updateSendTxStatus({
        isInsufficientTokenBalance: false,
        isInsufficientNativeBalance,
        fillUpNativeBalance: fillUpNativeBalance
          .sd(4, BigNumber.ROUND_UP)
          .toFixed(),
        isBaseOnEstimateMaxFee:
          selectedFee?.totalNativeMinForDisplay !== totalFeeNative,
        maxFeeNative: new BigNumber(totalFeeNative ?? 0)
          .sd(4, BigNumber.ROUND_UP)
          .toFixed(),
      });
    }
  }, [
    decodedTxs,
    txFeeInfoInit,
    extraFeeInfo.feeNative,
    isResourceRentalEnabled,
    isResourceRentalNeeded,
    isSwapTrxEnabled,
    nativeTokenInfo,
    nativeTokenInfo.balance,
    nativeTokenInfo.isLoading,
    nativeTokenTransferAmountToUpdate,
    payTokenInfo?.payTxFeeAmount,
    payTokenInfo?.totalAmount,
    payType,
    payWithTokenInfo.balance,
    payWithTokenInfo.enabled,
    selectedFee,
    tokenTransferAmount,
    updateSendFeeStatus,
    updateSendTxStatus,
  ]);

  useEffect(() => {
    appEventBus.emit(EAppEventBusNames.TxFeeInfoChanged, {
      feeSelectorItems,
    });
  }, [feeSelectorItems]);

  useEffect(() => {
    const callback = () => run();
    appEventBus.on(EAppEventBusNames.EstimateTxFeeRetry, callback);
    return () => {
      appEventBus.off(EAppEventBusNames.EstimateTxFeeRetry, callback);
    };
  }, [run]);

  useEffect(() => {
    if (unsignedTxs?.[0]?.uuid) {
      updateTxFeeInfoInit(false);
    }
  }, [unsignedTxs, updateTxFeeInfoInit]);

  const handlePress = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.swap_history_detail_network_fee,
      }),
      isAsync: true,
      showFooter: false,
      disableDrag: platformEnv.isNative,
      dismissOnOverlayPress: !platformEnv.isNative,
      renderContent: (
        <TxFeeEditor
          networkId={networkId}
          feeSelectorItems={
            isEmpty(feeSelectorItems)
              ? multiTxsFeeSelectorItems.map((item) => ({
                  ...item,
                  feeInfo: item.feeInfos[0],
                }))
              : feeSelectorItems
          }
          selectedFee={selectedFee?.feeInfos?.[0]}
          sendSelectedFee={sendSelectedFee}
          unsignedTxs={unsignedTxs}
          originalCustomFee={customFee}
          onApplyFeeInfo={handleApplyFeeInfo}
          estimateFeeParams={estimateFeeParams}
        />
      ),
    });
  }, [
    customFee,
    estimateFeeParams,
    feeSelectorItems,
    handleApplyFeeInfo,
    intl,
    multiTxsFeeSelectorItems,
    networkId,
    selectedFee?.feeInfos,
    sendSelectedFee,
    unsignedTxs,
  ]);

  const renderFeeEditor = useCallback(() => {
    if (
      !vaultSettings?.editFeeEnabled ||
      !feeInfoEditable ||
      megafuelEligible.sponsorable
    ) {
      return null;
    }

    if (sendFeeStatus.errMessage) return null;

    if (!txFeeInfoInit) {
      return (
        <Stack py="$1">
          <Skeleton height="$3" width="$12" />
        </Stack>
      );
    }

    if (!openFeeEditorEnabled) {
      return (
        <SizableText size="$bodyMdMedium">
          {intl.formatMessage({
            id: getFeeLabel({
              feeType: sendSelectedFee.feeType,
              presetIndex: sendSelectedFee.presetIndex,
              isSinglePreset,
            }),
          })}
        </SizableText>
      );
    }

    return (
      <TxFeeSelectorTrigger
        onPress={handlePress}
        disabled={
          sendFeeStatus.status === ESendFeeStatus.Error || !txFeeInfoInit
        }
      />
    );
  }, [
    feeInfoEditable,
    megafuelEligible.sponsorable,
    handlePress,
    intl,
    isSinglePreset,
    openFeeEditorEnabled,
    sendFeeStatus.errMessage,
    sendFeeStatus.status,
    sendSelectedFee.feeType,
    sendSelectedFee.presetIndex,
    txFeeInfoInit,
    vaultSettings?.editFeeEnabled,
  ]);

  const renderTotalNative = useCallback(() => {
    if (megafuelEligible.sponsorable) {
      return null;
    }

    if (isResourceRentalNeeded && isResourceRentalEnabled && payTokenInfo) {
      let payTokenAmount = payTokenInfo.totalAmount;

      if (payType === ETronResourceRentalPayType.Token && !isSwapTrxEnabled) {
        payTokenAmount = payTokenInfo.payTxFeeAmount;
      }

      return (
        <NumberSizeableText
          size="$bodyMd"
          color="$text"
          formatter="balance"
          formatterOptions={{
            tokenSymbol: payTokenInfo.symbol,
            keepLeadingZero: true,
          }}
        >
          {payTokenAmount ?? '-'}
        </NumberSizeableText>
      );
    }

    return (
      <NumberSizeableText
        size="$bodyMd"
        color="$text"
        formatter="balance"
        formatterOptions={{
          tokenSymbol: txFeeCommon?.nativeSymbol,
          keepLeadingZero: true,
        }}
      >
        {selectedFee?.totalNativeMinForDisplay ?? '-'}
      </NumberSizeableText>
    );
  }, [
    megafuelEligible.sponsorable,
    isResourceRentalEnabled,
    isResourceRentalNeeded,
    isSwapTrxEnabled,
    payTokenInfo,
    payType,
    selectedFee?.totalNativeMinForDisplay,
    txFeeCommon?.nativeSymbol,
  ]);

  const renderTotalFiat = useCallback(() => {
    if (megafuelEligible.sponsorable) {
      return null;
    }

    if (isResourceRentalNeeded && isResourceRentalEnabled && payTokenInfo) {
      let payTokenAmount = payTokenInfo.totalAmount;

      if (payType === ETronResourceRentalPayType.Token && !isSwapTrxEnabled) {
        payTokenAmount = payTokenInfo.payTxFeeAmount;
      }

      const totalFiat = new BigNumber(payTokenAmount ?? 0).times(
        payTokenInfo.price ?? 0,
      );

      return (
        <SizableText size="$bodyMd" color="$textSubdued">
          (
          <NumberSizeableText
            size="$bodyMd"
            color="$text"
            formatter="value"
            formatterOptions={{
              currency: settings.currencyInfo.symbol,
            }}
          >
            {totalFiat.toFixed() ?? '-'}
          </NumberSizeableText>
          )
        </SizableText>
      );
    }

    return (
      <SizableText size="$bodyMd" color="$textSubdued">
        (
        <NumberSizeableText
          size="$bodyMd"
          color="$text"
          formatter="value"
          formatterOptions={{
            currency: settings.currencyInfo.symbol,
          }}
        >
          {selectedFee?.totalFiatMinForDisplay ?? '-'}
        </NumberSizeableText>
        )
      </SizableText>
    );
  }, [
    megafuelEligible.sponsorable,
    selectedFee?.totalFiatMinForDisplay,
    isResourceRentalNeeded,
    isResourceRentalEnabled,
    payTokenInfo,
    settings.currencyInfo.symbol,
    payType,
    isSwapTrxEnabled,
  ]);

  const renderOriginalFeeInfo = useCallback(() => {
    if (
      (!isResourceRentalNeeded || !isResourceRentalEnabled) &&
      !transferPayload?.isTronResourceAutoClaimed &&
      !megafuelEligible.sponsorable
    ) {
      return null;
    }

    const textColor = megafuelEligible.sponsorable ? '$text' : '$textSubdued';

    let totalNative = megafuelEligible.sponsorable
      ? selectedFee?.originalTotalNative
      : selectedFee?.totalNativeMinForDisplay;

    let totalFiat = megafuelEligible.sponsorable
      ? selectedFee?.originalTotalFiat
      : selectedFee?.totalFiatMinForDisplay;

    if (
      transferPayload?.isTronResourceAutoClaimed &&
      transferPayload?.txOriginalFee
    ) {
      totalNative = transferPayload?.txOriginalFee.totalNative;
      totalFiat = transferPayload?.txOriginalFee.totalFiat;
    }

    return (
      <XStack alignItems="center">
        <SizableText
          size="$bodyMd"
          color={textColor}
          textDecorationLine="line-through"
          textDecorationColor={textColor}
          textDecorationStyle="solid"
        >
          <NumberSizeableText
            size="$bodyMd"
            color={textColor}
            formatter="balance"
            formatterOptions={{
              tokenSymbol: txFeeCommon?.nativeSymbol,
              keepLeadingZero: true,
            }}
          >
            {totalNative ?? '-'}
          </NumberSizeableText>
          (
          <NumberSizeableText
            size="$bodyMd"
            color={textColor}
            formatter="value"
            formatterOptions={{
              currency: settings.currencyInfo.symbol,
            }}
          >
            {totalFiat ?? '-'}
          </NumberSizeableText>
          )
        </SizableText>
        {megafuelEligible.sponsorable ? (
          <Badge badgeSize="sm" badgeType="success">
            <Badge.Text>
              {intl.formatMessage({
                id: ETranslations.prime_status_free,
              })}
            </Badge.Text>
          </Badge>
        ) : null}
        {sendFeeStatus.discountPercent && sendFeeStatus.discountPercent > 0 ? (
          <Badge badgeSize="sm" badgeType="success">
            <Badge.Text>
              {sendFeeStatus.discountPercent === 100
                ? intl.formatMessage({
                    id: ETranslations.prime_status_free,
                  })
                : intl.formatMessage(
                    {
                      id: ETranslations.wallet_discount_number,
                    },
                    { number: `${sendFeeStatus.discountPercent}%` },
                  )}
            </Badge.Text>
          </Badge>
        ) : null}
      </XStack>
    );
  }, [
    isResourceRentalNeeded,
    isResourceRentalEnabled,
    transferPayload?.isTronResourceAutoClaimed,
    transferPayload?.txOriginalFee,
    megafuelEligible.sponsorable,
    selectedFee?.originalTotalNative,
    selectedFee?.totalNativeMinForDisplay,
    selectedFee?.originalTotalFiat,
    selectedFee?.totalFiatMinForDisplay,
    txFeeCommon?.nativeSymbol,
    settings.currencyInfo.symbol,
    intl,
    sendFeeStatus.discountPercent,
  ]);

  useEffect(() => {
    if (txAdvancedSettings.dataChanged) {
      updateTxFeeInfoInit(false);
    }
  }, [
    txAdvancedSettings.dataChanged,
    updateSendSelectedFee,
    updateTxAdvancedSettings,
    updateTxFeeInfoInit,
  ]);

  useEffect(() => {
    let originalTotalFiat = selectedFee?.totalFiatMinForDisplay;
    let totalFiat = selectedFee?.totalFiatMinForDisplay;

    if (
      transferPayload?.isTronResourceAutoClaimed &&
      transferPayload?.txOriginalFee
    ) {
      originalTotalFiat = transferPayload?.txOriginalFee.totalFiat;
    }

    if (isResourceRentalNeeded && isResourceRentalEnabled && payTokenInfo) {
      let payTokenAmount = payTokenInfo.totalAmount;

      if (payType === ETronResourceRentalPayType.Token && !isSwapTrxEnabled) {
        payTokenAmount = payTokenInfo.payTxFeeAmount;
      }

      totalFiat = new BigNumber(payTokenAmount ?? 0)
        .times(payTokenInfo.price ?? 0)
        .toFixed();
    }

    if (
      !isNil(originalTotalFiat) &&
      !isNil(totalFiat) &&
      new BigNumber(originalTotalFiat ?? 0).gt(0)
    ) {
      const discountPercent = new BigNumber(originalTotalFiat ?? 0)
        .minus(totalFiat ?? 0)
        .dividedBy(originalTotalFiat ?? 0)
        .multipliedBy(100)
        .dp(0)
        .toNumber();

      updateSendFeeStatus({
        discountPercent,
      });
    }
  }, [
    isResourceRentalEnabled,
    isResourceRentalNeeded,
    isSwapTrxEnabled,
    megafuelEligible.sponsorable,
    payTokenInfo,
    payType,
    selectedFee?.totalFiatMinForDisplay,
    transferPayload?.isTronResourceAutoClaimed,
    transferPayload?.txOriginalFee,
    updateSendFeeStatus,
  ]);

  return (
    <Stack {...feeInfoWrapperProps}>
      <XStack gap="$2" alignItems="center" pb="$1">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_est_network_fee,
          })}
        </SizableText>
        {vaultSettings?.editFeeEnabled &&
        feeInfoEditable &&
        !sendFeeStatus.errMessage &&
        !megafuelEligible.sponsorable ? (
          <SizableText size="$bodyMd" color="$textSubdued">
            •
          </SizableText>
        ) : null}
        {renderFeeEditor()}
      </XStack>
      {renderOriginalFeeInfo()}
      <XStack gap="$1" alignItems="center">
        {txFeeInfoInit ? (
          renderTotalNative()
        ) : (
          <Stack py="$1">
            <Skeleton height="$3" width="$24" />
          </Stack>
        )}
        {txFeeInfoInit && !isNil(selectedFee?.totalFiatMinForDisplay)
          ? renderTotalFiat()
          : ''}
      </XStack>
    </Stack>
  );
}
export default memo(TxFeeInfo);
