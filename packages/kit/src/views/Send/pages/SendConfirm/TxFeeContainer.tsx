import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isEmpty, isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Dialog,
  Divider,
  Image,
  NumberSizeableText,
  Popover,
  SizableText,
  Skeleton,
  Stack,
  XStack,
} from '@onekeyhq/components';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useCustomFeeAtom,
  useNativeTokenInfoAtom,
  useNativeTokenTransferAmountToUpdateAtom,
  useSendConfirmActions,
  useSendFeeStatusAtom,
  useSendSelectedFeeAtom,
  useSendTxStatusAtom,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';
import {
  calculateFeeForSend,
  getFeeIcon,
  getFeeLabel,
} from '@onekeyhq/kit/src/utils/gasFee';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IOneKeyRpcError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';
import { EFeeType, ESendFeeStatus } from '@onekeyhq/shared/types/fee';
import type {
  IFeeInfoUnit,
  IFeeSelectorItem,
} from '@onekeyhq/shared/types/fee';

import {
  InfoItem,
  InfoItemGroup,
} from '../../../AssetDetails/pages/HistoryDetails/components/TxDetailsInfoItem';
import { FeeEditor, FeeSelectorTrigger } from '../../components/SendFee';

type IProps = {
  accountId: string;
  networkId: string;
  useFeeInTx?: boolean;
  tableLayout?: boolean;
};

function TxFeeContainer(props: IProps) {
  const { accountId, networkId, useFeeInTx } = props;
  const intl = useIntl();
  const txFeeInit = useRef(false);
  const feeInTxUpdated = useRef(false);
  const [sendSelectedFee] = useSendSelectedFeeAtom();
  const [customFee] = useCustomFeeAtom();
  const [settings] = useSettingsPersistAtom();
  const [sendFeeStatus] = useSendFeeStatusAtom();
  const [nativeTokenInfo] = useNativeTokenInfoAtom();
  const [unsignedTxs] = useUnsignedTxsAtom();
  const [nativeTokenTransferAmountToUpdate] =
    useNativeTokenTransferAmountToUpdateAtom();
  const {
    updateSendSelectedFeeInfo,
    updateSendFeeStatus,
    updateSendTxStatus,
    updateCustomFee,
    updateSendSelectedFee,
  } = useSendConfirmActions().current;

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

  const { result, isLoading } = usePromiseResult(
    async () => {
      try {
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

        const r = await backgroundApiProxy.serviceGas.estimateFee({
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
        txFeeInit.current = true;
        return {
          r,
          e,
        };
      } catch (e) {
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
    [accountId, networkId, unsignedTxs, updateSendFeeStatus],
    {
      watchLoading: true,
      pollingInterval: 6000,
      overrideIsFocused: (isPageFocused) =>
        isPageFocused && sendSelectedFee.feeType !== EFeeType.Custom,
    },
  );

  const { r: txFee, e: estimateFeeParams } = result ?? {};

  const openFeeEditorEnabled =
    !!vaultSettings?.editFeeEnabled || !!vaultSettings?.checkFeeDetailEnabled;

  const feeSelectorItems: IFeeSelectorItem[] = useMemo(() => {
    const items = [];
    if (txFee) {
      const feeLength =
        txFee.gasEIP1559?.length ||
        txFee.gas?.length ||
        txFee.feeUTXO?.length ||
        txFee.feeTron?.length ||
        txFee.gasFil?.length ||
        txFee.feeSol?.length ||
        0;

      for (let i = 0; i < feeLength; i += 1) {
        const feeInfo: IFeeInfoUnit = {
          common: txFee?.common,
          gas: txFee.gas?.[i],
          gasEIP1559: txFee.gasEIP1559?.[i],
          feeUTXO: txFee.feeUTXO?.[i],
          feeTron: txFee.feeTron?.[i],
          gasFil: txFee.gasFil?.[i],
          feeSol: txFee.feeSol?.[i],
        };

        items.push({
          label: intl.formatMessage({
            id: getFeeLabel({ feeType: EFeeType.Standard, presetIndex: i }),
          }),
          icon: getFeeIcon({ feeType: EFeeType.Standard, presetIndex: i }),
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

      if (vaultSettings?.editFeeEnabled) {
        const customFeeInfo: IFeeInfoUnit = {
          common: txFee.common,
        };

        if (txFee.gas) {
          customFeeInfo.gas = {
            ...txFee.gas[sendSelectedFee.presetIndex],
            ...(customFee?.gas ?? {}),
          };
        }

        if (txFee.gasEIP1559) {
          customFeeInfo.gasEIP1559 = {
            ...txFee.gasEIP1559[sendSelectedFee.presetIndex],
            ...(customFee?.gasEIP1559 ?? {}),
          };
        }

        if (txFee.feeUTXO) {
          customFeeInfo.feeUTXO = {
            ...txFee.feeUTXO[sendSelectedFee.presetIndex],
            ...(customFee?.feeUTXO ?? {}),
          };
        }

        if (txFee.feeSol) {
          customFeeInfo.feeSol = {
            ...txFee.feeSol[sendSelectedFee.presetIndex],
            ...(customFee?.feeSol ?? {}),
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
          } else if (limit) {
            if (customFeeInfo.gasEIP1559) {
              customFeeInfo.gasEIP1559 = {
                ...customFeeInfo.gasEIP1559,
                gasLimit: limit,
                gasLimitForDisplay: limit,
              };
            }
            if (customFeeInfo.gas) {
              customFeeInfo.gas = {
                ...customFeeInfo.gas,
                gasLimit: limit,
                gasLimitForDisplay: limit,
              };
            }
          }

          updateSendSelectedFee({
            feeType: EFeeType.Custom,
            presetIndex: 0,
          });

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
    vaultSettings?.editFeeEnabled,
    intl,
    useFeeInTx,
    network,
    sendSelectedFee.presetIndex,
    customFee?.gas,
    customFee?.gasEIP1559,
    customFee?.feeUTXO,
    customFee?.feeSol,
    unsignedTxs,
    updateSendSelectedFee,
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

    const {
      total,
      totalNative,
      totalFiat,
      totalNativeForDisplay,
      totalFiatForDisplay,
    } = calculateFeeForSend({
      feeInfo: selectedFeeInfo,
      nativeTokenPrice: txFee?.common.nativeTokenPrice ?? 0,
      txSize: unsignedTxs[0]?.txSize,
      estimateFeeParams,
    });

    return {
      selectedFee: {
        feeInfo: selectedFeeInfo,
        total,
        totalNative,
        totalFiat,
        totalNativeForDisplay,
        totalFiatForDisplay,
      },
    };
  }, [
    estimateFeeParams,
    feeSelectorItems,
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
    if (selectedFee && selectedFee.feeInfo) {
      updateSendSelectedFeeInfo(selectedFee);
    }
  }, [selectedFee, updateSendSelectedFeeInfo]);

  useEffect(() => {
    void backgroundApiProxy.serviceGas
      .getFeePresetIndex({
        networkId,
      })
      .then((presetIndex) => {
        const index = presetIndex ?? vaultSettings?.defaultFeePresetIndex;
        if (!isNil(index)) {
          updateSendSelectedFee({
            presetIndex: index,
          });
        }
      });
  }, [networkId, updateSendSelectedFee, vaultSettings?.defaultFeePresetIndex]);

  useEffect(() => {
    if (!txFeeInit.current || nativeTokenInfo.isLoading) return;

    updateSendTxStatus({
      isInsufficientNativeBalance: nativeTokenTransferAmountToUpdate.isMaxSend
        ? false
        : new BigNumber(nativeTokenTransferAmountToUpdate.amountToUpdate ?? 0)
            .plus(selectedFee?.totalNative ?? 0)
            .gt(nativeTokenInfo.balance ?? 0),
    });
  }, [
    nativeTokenInfo.balance,
    nativeTokenInfo.isLoading,
    nativeTokenTransferAmountToUpdate,
    selectedFee?.totalNative,
    updateSendFeeStatus,
    updateSendTxStatus,
  ]);

  useEffect(() => {
    appEventBus.emit(EAppEventBusNames.TxFeeInfoChanged, {
      feeSelectorItems,
    });
  }, [feeSelectorItems]);

  const handlePress = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.swap_history_detail_network_fee,
      }),
      showFooter: false,
      renderContent: (
        <FeeEditor
          networkId={networkId}
          feeSelectorItems={feeSelectorItems}
          selectedFee={selectedFee}
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
    if (!txFeeInit.current || !feeSelectorItems.length) {
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
            }),
          })}
        </SizableText>
      );
    }

    return (
      <FeeSelectorTrigger
        onPress={handlePress}
        disabled={
          sendFeeStatus.status === ESendFeeStatus.Error || !txFeeInit.current
        }
      />
    );
    // return (
    //   <Popover
    //     title={intl.formatMessage({ id: ETranslations.title__edit_fee })}
    //     open={isEditFeeActive}
    //     onOpenChange={setIsEditFeeActive}
    //     allowFlip={false}

    //     renderTrigger={
    //       <FeeSelectorTrigger
    //         onPress={() => setIsEditFeeActive(true)}
    //         disabled={
    //           sendFeeStatus.status === ESendFeeStatus.Error ||
    //           !txFeeInit.current
    //         }
    //       />
    //     }
    //   />
    // );
  }, [
    feeSelectorItems.length,
    handlePress,
    intl,
    openFeeEditorEnabled,
    sendFeeStatus.status,
    sendSelectedFee.feeType,
    sendSelectedFee.presetIndex,
  ]);

  return (
    <>
      <Divider mx="$5" />
      <InfoItemGroup
        animation="repeat"
        animateOnly={['opacity']}
        opacity={isLoading && txFeeInit.current ? 0.5 : 1}
      >
        <InfoItem
          label={intl.formatMessage({
            id: ETranslations.global_est_network_fee,
          })}
          renderContent={
            <>
              <XStack space="$1">
                <XStack space="$1">
                  {txFeeInit.current ? (
                    <NumberSizeableText
                      formatter="balance"
                      formatterOptions={{
                        tokenSymbol: txFee?.common.nativeSymbol,
                      }}
                      size="$bodyMd"
                      color="$textSubdued"
                    >
                      {selectedFee?.totalNativeForDisplay ?? '0.00'}
                    </NumberSizeableText>
                  ) : (
                    <Stack py="$1">
                      <Skeleton height="$3" width="$24" />
                    </Stack>
                  )}
                  {txFeeInit.current ? (
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
                        {selectedFee?.totalFiatForDisplay ?? '0.00'}
                      </NumberSizeableText>
                      )
                    </SizableText>
                  ) : (
                    ''
                  )}
                </XStack>
                <SizableText size="$bodyMd" color="$textSubdued">
                  •
                </SizableText>
                {renderFeeEditor()}
              </XStack>
            </>
          }
        />
      </InfoItemGroup>
      {/* <Container.Box>
        <Container.Item
          title="Fee Estimate"
          content={
            txFeeInit.current ? (
              <NumberSizeableText
                formatter="balance"
                formatterOptions={{
                  tokenSymbol: txFee?.common.nativeSymbol,
                }}
                size="$bodyMdMedium"
                color="$text"
              >
                {selectedFee?.totalNativeForDisplay ?? '0.00'}
              </NumberSizeableText>
            ) : (
              <Skeleton height="$5" width="$40" />
            )
          }
          subContent={
            txFeeInit.current ? (
              <NumberSizeableText
                size="$bodyMdMedium"
                color="$textSubdued"
                formatter="value"
                formatterOptions={{ currency: settings.currencyInfo.symbol }}
              >
                {selectedFee?.totalFiatForDisplay ?? '0.00'}
              </NumberSizeableText>
            ) : (
              ''
            )
          }
          contentAdd={renderFeeEditor()}
          description={{
            content: (
              <YStack flex={1}>
                {sendFeeStatus.errMessage ? (
                  <SizableText size="$bodyMd" color="$textCritical">
                    {sendFeeStatus.errMessage}
                  </SizableText>
                ) : null}
                {sendAlertStatus.isInsufficientNativeBalance ? (
                  <SizableText size="$bodyMd" color="$textCritical">
                    {intl.formatMessage(
                      {
                        id: 'msg__str_is_required_for_network_fees_top_up_str_to_make_tx',
                      },
                      {
                        0: network?.symbol ?? '',
                        1: network?.name ?? '',
                      },
                    )}
                  </SizableText>
                ) : null}
              </YStack>
            ),
          }}
        />
      </Container.Box> */}
    </>
  );
}
export default memo(TxFeeContainer);
