import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isEmpty, isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Dialog,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  XStack,
} from '@onekeyhq/components';
import type { IEncodedTxBtc } from '@onekeyhq/core/src/chains/btc/types';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useCustomFeeAtom,
  useIsSinglePresetAtom,
  useNativeTokenInfoAtom,
  useNativeTokenTransferAmountToUpdateAtom,
  useSendConfirmActions,
  useSendFeeStatusAtom,
  useSendSelectedFeeAtom,
  useSendTxStatusAtom,
  useTxAdvancedSettingsAtom,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';
import {
  calculateFeeForSend,
  getFeeIcon,
  getFeeLabel,
} from '@onekeyhq/kit/src/utils/gasFee';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ALGO_TX_MIN_FEE } from '@onekeyhq/kit-bg/src/vaults/impls/algo/utils';
import {
  BATCH_SEND_TXS_FEE_DOWN_RATIO_FOR_TOTAL,
  BATCH_SEND_TXS_FEE_UP_RATIO_FOR_APPROVE,
  BATCH_SEND_TXS_FEE_UP_RATIO_FOR_SWAP,
} from '@onekeyhq/shared/src/consts/walletConsts';
import type { IOneKeyRpcError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EFeeType, ESendFeeStatus } from '@onekeyhq/shared/types/fee';
import type {
  IFeeInfoUnit,
  IFeeSelectorItem,
} from '@onekeyhq/shared/types/fee';

import { FeeEditor, FeeSelectorTrigger } from '../../components/SendFee';

type IProps = {
  accountId: string;
  networkId: string;
  useFeeInTx?: boolean;
  feeInfoEditable?: boolean;
  tableLayout?: boolean;
};

function TxFeeContainer(props: IProps) {
  const { accountId, networkId, useFeeInTx, feeInfoEditable = true } = props;
  const intl = useIntl();
  const [txFeeInit, setTxFeeInit] = useState(false);
  const feeInTxUpdated = useRef(false);
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
  const {
    updateSendSelectedFeeInfo,
    updateSendFeeStatus,
    updateSendTxStatus,
    updateCustomFee,
    updateSendSelectedFee,
    updateIsSinglePreset,
    updateTxAdvancedSettings,
  } = useSendConfirmActions().current;

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

  const isSecondApproveTxWithFeeInfo = useMemo(
    () =>
      unsignedTxs.length === 1 &&
      unsignedTxs[0].approveInfo &&
      unsignedTxs[0].feeInfo,
    [unsignedTxs],
  );

  const { result: [vaultSettings, network] = [] } =
    usePromiseResult(async () => {
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId,
        networkId,
      });

      if (!account) return;

      return Promise.all([
        backgroundApiProxy.serviceNetwork.getVaultSettings({ networkId }),
        backgroundApiProxy.serviceNetwork.getNetwork({ networkId }),
      ]);
    }, [accountId, networkId]);

  const { result, run } = usePromiseResult(
    async () => {
      try {
        await backgroundApiProxy.serviceGas.abortEstimateFee();

        updateSendFeeStatus({
          status: ESendFeeStatus.Loading,
        });

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

        if (
          (isLastSwapTxWithFeeInfo || isSecondApproveTxWithFeeInfo) &&
          unsignedTxs[0].feeInfo
        ) {
          const r = unsignedTxs[0].feeInfo;
          updateSendFeeStatus({
            status: ESendFeeStatus.Success,
            errMessage: '',
          });
          setTxFeeInit(true);
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
            },
            e,
          };
        }

        const r = await backgroundApiProxy.serviceGas.estimateFee({
          accountId,
          networkId,
          encodedTx,
          accountAddress,
        });
        // if gasEIP1559 returns 5 gas level, then pick the 1st, 3rd and 5th as default gas level
        // these five levels are also provided as predictions on the custom fee page for users to choose
        if (r.gasEIP1559 && r.gasEIP1559.length === 5) {
          r.gasEIP1559 = [r.gasEIP1559[0], r.gasEIP1559[2], r.gasEIP1559[4]];
        } else if (r.gasEIP1559) {
          r.gasEIP1559 = r.gasEIP1559.slice(0, 3);
        }

        updateSendFeeStatus({
          status: ESendFeeStatus.Success,
          errMessage: '',
        });
        setTxFeeInit(true);
        updateTxAdvancedSettings({ dataChanged: false });
        return {
          r,
          e,
        };
      } catch (e) {
        setTxFeeInit(true);
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
      isSecondApproveTxWithFeeInfo,
      networkId,
      unsignedTxs,
      updateSendFeeStatus,
      updateTxAdvancedSettings,
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

  const { r: txFee, e: estimateFeeParams } = result ?? {};

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
        };

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
        const customFeeInfo: IFeeInfoUnit = {
          common: txFee.common,
        };

        if (txFee.gas && !isEmpty(txFee.gas)) {
          customFeeInfo.gas = {
            ...txFee.gas[sendSelectedFee.presetIndex],
            ...(customFee?.gas ?? {}),
          };
        }

        if (txFee.gasEIP1559 && !isEmpty(txFee.gasEIP1559)) {
          customFeeInfo.gasEIP1559 = {
            ...txFee.gasEIP1559[sendSelectedFee.presetIndex],
            ...(customFee?.gasEIP1559 ?? {}),
          };
        }

        if (txFee.feeUTXO && !isEmpty(txFee.feeUTXO)) {
          customFeeInfo.feeUTXO = {
            ...txFee.feeUTXO[sendSelectedFee.presetIndex],
            ...(customFee?.feeUTXO ?? {}),
          };
        }

        if (txFee.feeSol && !isEmpty(txFee.feeSol)) {
          customFeeInfo.feeSol = {
            ...txFee.feeSol[sendSelectedFee.presetIndex],
            ...(customFee?.feeSol ?? {}),
          };
        }

        if (txFee.feeCkb && !isEmpty(txFee.feeCkb)) {
          customFeeInfo.feeCkb = {
            ...txFee.feeCkb[sendSelectedFee.presetIndex],
            ...(customFee?.feeCkb ?? {}),
          };
        }

        if (txFee.feeAlgo && !isEmpty(txFee.feeAlgo)) {
          customFeeInfo.feeAlgo = {
            ...txFee.feeAlgo[sendSelectedFee.presetIndex],
            ...(customFee?.feeAlgo ?? {
              minFee: ALGO_TX_MIN_FEE,
              baseFee: ALGO_TX_MIN_FEE,
            }),
          };
        }

        if (txFee.feeDot && !isEmpty(txFee.feeDot)) {
          customFeeInfo.feeDot = {
            ...txFee.feeDot[sendSelectedFee.presetIndex],
            ...(customFee?.feeDot ?? { extraTipInDot: '0' }),
          };
        }

        if (useFeeInTx && network && !feeInTxUpdated.current) {
          const {
            gas,
            gasLimit,
            gasPrice,
            maxFeePerGas,
            maxPriorityFeePerGas,
          } = unsignedTxs[0].encodedTx as IEncodedTxEvm;

          const limit = gasLimit || gas;
          let originalFeeChanged = false;
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

          if (originalFeeChanged) {
            updateSendSelectedFee({
              feeType: EFeeType.Custom,
              presetIndex: 0,
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
    intl,
    isSinglePreset,
    network,
    sendSelectedFee.presetIndex,
    customFee?.gas,
    customFee?.gasEIP1559,
    customFee?.feeUTXO,
    customFee?.feeSol,
    customFee?.feeCkb,
    customFee?.feeAlgo,
    customFee?.feeDot,
    unsignedTxs,
    updateSendSelectedFee,
    updateCustomFee,
  ]);

  const { selectedFee } = useMemo(() => {
    let selectedFeeInfo;

    if (isEmpty(feeSelectorItems)) return {};

    if (sendSelectedFee.feeType === EFeeType.Custom) {
      selectedFeeInfo = feeSelectorItems[feeSelectorItems.length - 1].feeInfo;
    } else {
      let feeSelectorItem =
        feeSelectorItems[sendSelectedFee.presetIndex] ?? feeSelectorItems[0];
      if (feeSelectorItem.type === EFeeType.Custom) {
        feeSelectorItem = feeSelectorItems[0];
      }
      selectedFeeInfo = feeSelectorItem.feeInfo;
    }

    const feeInfos: {
      feeInfo: IFeeInfoUnit;
      total: string;
      totalNative: string;
      totalFiat: string;
      totalNativeForDisplay: string;
      totalFiatForDisplay: string;
    }[] = [];

    let baseGasLimit =
      selectedFeeInfo.gas?.gasLimit ?? selectedFeeInfo.gasEIP1559?.gasLimit;

    let total = new BigNumber(0);
    let totalNative = new BigNumber(0);
    let totalFiat = new BigNumber(0);
    let totalNativeForDisplay = new BigNumber(0);
    let totalFiatForDisplay = new BigNumber(0);

    for (let i = 0; i < unsignedTxs.length; i += 1) {
      const unsignedTx = unsignedTxs[i];
      let specialGasLimit: string | undefined;

      // build second approve tx fee info base on first approve fee info
      if (
        (isMultiTxs && unsignedTx.approveInfo && i !== 0) ||
        isSecondApproveTxWithFeeInfo
      ) {
        specialGasLimit = new BigNumber(baseGasLimit ?? 0)
          .times(BATCH_SEND_TXS_FEE_UP_RATIO_FOR_APPROVE)
          .toFixed();
        baseGasLimit = specialGasLimit;
      }
      // build swap tx fee info base on first approve fee info
      else if (
        (isMultiTxs || isLastSwapTxWithFeeInfo) &&
        unsignedTx.swapInfo &&
        (selectedFeeInfo.gas || selectedFeeInfo.gasEIP1559)
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
            .times(allRoutesLength.plus(BATCH_SEND_TXS_FEE_UP_RATIO_FOR_SWAP))
            .toFixed();
        } else {
          specialGasLimit = new BigNumber(baseGasLimit ?? 0)
            .times(BATCH_SEND_TXS_FEE_UP_RATIO_FOR_SWAP)
            .toFixed();
        }
      }

      const txFeeInfo = {
        ...selectedFeeInfo,
        gas: selectedFeeInfo.gas
          ? {
              ...selectedFeeInfo.gas,
              gasLimit: specialGasLimit ?? selectedFeeInfo.gas?.gasLimit,
              gasLimitForDisplay:
                specialGasLimit ?? selectedFeeInfo.gas?.gasLimitForDisplay,
            }
          : undefined,
        gasEIP1559: selectedFeeInfo.gasEIP1559
          ? {
              ...selectedFeeInfo.gasEIP1559,
              gasLimit: specialGasLimit ?? selectedFeeInfo.gasEIP1559?.gasLimit,
              gasLimitForDisplay:
                specialGasLimit ??
                selectedFeeInfo.gasEIP1559?.gasLimitForDisplay,
            }
          : undefined,
      };

      const feeResult = calculateFeeForSend({
        feeInfo: txFeeInfo,
        nativeTokenPrice: txFee?.common.nativeTokenPrice ?? 0,
        txSize: unsignedTx.txSize,
        estimateFeeParams,
      });

      total = total.plus(feeResult.total);
      totalNative = totalNative.plus(feeResult.totalNative);
      totalFiat = totalFiat.plus(feeResult.totalFiat);
      totalNativeForDisplay = totalNativeForDisplay.plus(
        feeResult.totalNativeForDisplay,
      );
      totalFiatForDisplay = totalFiatForDisplay.plus(
        feeResult.totalFiatForDisplay,
      );

      feeInfos.push({
        feeInfo: txFeeInfo,
        total: feeResult.total,
        totalNative: feeResult.totalNative,
        totalFiat: feeResult.totalFiat,
        totalNativeForDisplay: feeResult.totalNativeForDisplay,
        totalFiatForDisplay: feeResult.totalFiatForDisplay,
      });
    }

    // Due to the tendency to use higher fee estimates for approve&swap multi-txs to ensure success,
    // we adjust the displayed fee to be closer to the actual on-chain cost for the user
    if (
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
        totalNative: totalNative.toFixed(),
        totalFiat: totalFiat.toFixed(),
        totalNativeForDisplay: totalNativeForDisplay.toFixed(),
        totalFiatForDisplay: totalFiatForDisplay.toFixed(),
      },
    };
  }, [
    estimateFeeParams,
    feeSelectorItems,
    isLastSwapTxWithFeeInfo,
    isMultiTxs,
    isSecondApproveTxWithFeeInfo,
    sendSelectedFee.feeType,
    sendSelectedFee.presetIndex,
    txFee?.common.nativeTokenPrice,
    unsignedTxs,
  ]);

  const handleApplyFeeInfo = useCallback(
    ({
      feeType,
      presetIndex,
      customFeeInfo,
    }: {
      feeType: EFeeType;
      presetIndex: number;
      customFeeInfo: IFeeInfoUnit;
    }) => {
      if (feeType === EFeeType.Custom) {
        updateSendSelectedFee({
          feeType: EFeeType.Custom,
          presetIndex: 0,
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
    if (!txFeeInit || nativeTokenInfo.isLoading || !nativeTokenInfo) return;

    updateSendTxStatus({
      isInsufficientNativeBalance: nativeTokenTransferAmountToUpdate.isMaxSend
        ? false
        : new BigNumber(nativeTokenTransferAmountToUpdate.amountToUpdate ?? 0)
            .plus(selectedFee?.totalNative ?? 0)
            .gt(nativeTokenInfo.balance ?? 0),
    });
  }, [
    nativeTokenInfo,
    nativeTokenInfo.balance,
    nativeTokenInfo.isLoading,
    nativeTokenTransferAmountToUpdate,
    selectedFee,
    txFeeInit,
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

  const handlePress = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.swap_history_detail_network_fee,
      }),
      isAsync: true,
      showFooter: false,
      renderContent: (
        <FeeEditor
          networkId={networkId}
          feeSelectorItems={feeSelectorItems}
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
    networkId,
    selectedFee,
    sendSelectedFee,
    unsignedTxs,
  ]);

  const renderFeeEditor = useCallback(() => {
    if (!vaultSettings?.editFeeEnabled || !feeInfoEditable) {
      return null;
    }

    if (sendFeeStatus.errMessage) return null;

    if (!txFeeInit) {
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
      <FeeSelectorTrigger
        onPress={handlePress}
        disabled={sendFeeStatus.status === ESendFeeStatus.Error || !txFeeInit}
      />
    );
  }, [
    feeInfoEditable,
    handlePress,
    intl,
    isSinglePreset,
    openFeeEditorEnabled,
    sendFeeStatus.errMessage,
    sendFeeStatus.status,
    sendSelectedFee.feeType,
    sendSelectedFee.presetIndex,
    txFeeInit,
    vaultSettings?.editFeeEnabled,
  ]);

  const renderTotalNative = useCallback(
    () => (
      <NumberSizeableText
        size="$bodyMd"
        color="$textSubdued"
        formatter="balance"
        formatterOptions={{
          tokenSymbol: txFee?.common.nativeSymbol,
        }}
      >
        {selectedFee?.totalNativeForDisplay ?? '-'}
      </NumberSizeableText>
    ),
    [selectedFee?.totalNativeForDisplay, txFee?.common.nativeSymbol],
  );

  const renderTotalFiat = useCallback(
    () => (
      <SizableText size="$bodyMd" color="$textSubdued">
        (
        <NumberSizeableText
          size="$bodyMd"
          color="$textSubdued"
          formatter="value"
          formatterOptions={{
            currency: settings.currencyInfo.symbol,
          }}
        >
          {selectedFee?.totalFiatForDisplay ?? '-'}
        </NumberSizeableText>
        )
      </SizableText>
    ),
    [selectedFee?.totalFiatForDisplay, settings.currencyInfo.symbol],
  );

  useEffect(() => {
    if (txAdvancedSettings.dataChanged) {
      setTxFeeInit(false);
    }
  }, [
    txAdvancedSettings.dataChanged,
    updateSendSelectedFee,
    updateTxAdvancedSettings,
  ]);

  return (
    <Stack
      mb="$5"
      $gtMd={{
        mb: '$0',
      }}
    >
      <XStack gap="$2" alignItems="center" pb="$1">
        <SizableText size="$bodyMdMedium">
          {intl.formatMessage({
            id: ETranslations.global_est_network_fee,
          })}
        </SizableText>
        {vaultSettings?.editFeeEnabled &&
        feeInfoEditable &&
        !sendFeeStatus.errMessage ? (
          <SizableText size="$bodyMd" color="$textSubdued">
            •
          </SizableText>
        ) : null}
        {renderFeeEditor()}
      </XStack>
      <XStack gap="$1" alignItems="center">
        {txFeeInit ? (
          renderTotalNative()
        ) : (
          <Stack py="$1">
            <Skeleton height="$3" width="$24" />
          </Stack>
        )}
        {txFeeInit && !isNil(selectedFee?.totalFiatForDisplay)
          ? renderTotalFiat()
          : ''}
      </XStack>
    </Stack>
  );
}
export default memo(TxFeeContainer);
