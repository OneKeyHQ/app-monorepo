import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isEmpty, isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  NumberSizeableText,
  Popover,
  SizableText,
  Skeleton,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Container } from '@onekeyhq/kit/src/components/Container';
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
  getFeeLabel,
} from '@onekeyhq/kit/src/utils/gasFee';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IOneKeyRpcError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { EFeeType, ESendFeeStatus } from '@onekeyhq/shared/types/fee';
import type {
  IFeeInfoUnit,
  IFeeSelectorItem,
} from '@onekeyhq/shared/types/fee';

import { FeeEditor, FeeSelectorTrigger } from '../../components/SendFee';

type IProps = {
  accountId: string;
  networkId: string;
  tableLayout?: boolean;
};

function TxFeeContainer(props: IProps) {
  const { accountId, networkId } = props;
  const intl = useIntl();
  const txFeeInit = useRef(false);
  const [isEditFeeActive, setIsEditFeeActive] = useState(false);
  const [sendSelectedFee] = useSendSelectedFeeAtom();
  const [customFee] = useCustomFeeAtom();
  const [settings] = useSettingsPersistAtom();
  const [sendFeeStatus] = useSendFeeStatusAtom();
  const [sendAlertStatus] = useSendTxStatusAtom();
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

  const { result: txFee } = usePromiseResult(
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
        const r = await backgroundApiProxy.serviceGas.estimateFee({
          networkId,
          encodedTx: await backgroundApiProxy.serviceGas.buildEstimateFeeParams(
            {
              accountId,
              networkId,
              encodedTx: unsignedTxs[0].encodedTx,
            },
          ),
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
        return r;
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
      pollingInterval: 6000,
      overrideIsFocused: (isPageFocused) =>
        isPageFocused && sendSelectedFee.feeType !== EFeeType.Custom,
    },
  );

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
        0;

      for (let i = 0; i < feeLength; i += 1) {
        const feeInfo: IFeeInfoUnit = {
          common: txFee?.common,
          gas: txFee.gas?.[i],
          gasEIP1559: txFee.gasEIP1559?.[i],
          feeUTXO: txFee.feeUTXO?.[i],
          feeTron: txFee.feeTron?.[i],
          gasFil: txFee.gasFil?.[i],
        };

        items.push({
          label: intl.formatMessage({
            id: getFeeLabel({ feeType: EFeeType.Standard, presetIndex: i }),
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

        if (customFee?.gas && txFee.gas) {
          customFeeInfo.gas = {
            ...customFee.gas,
            gasLimit:
              customFee.gas.gasLimit ??
              txFee.gas[sendSelectedFee.presetIndex].gasLimit,
            gasLimitForDisplay:
              customFee.gas.gasLimitForDisplay ??
              txFee.gas[sendSelectedFee.presetIndex].gasLimitForDisplay,
          };
        }

        if (customFee?.gasEIP1559 && txFee.gasEIP1559) {
          customFeeInfo.gasEIP1559 = {
            ...customFee.gasEIP1559,
            gasLimit:
              customFee.gasEIP1559.gasLimit ??
              txFee.gasEIP1559[sendSelectedFee.presetIndex].gasLimit,
            gasLimitForDisplay:
              customFee.gasEIP1559.gasLimitForDisplay ??
              txFee.gasEIP1559[sendSelectedFee.presetIndex].gasLimitForDisplay,
          };
        }

        if (customFee?.feeUTXO && txFee.feeUTXO) {
          customFeeInfo.feeUTXO = customFee.feeUTXO;
        }

        items.push({
          label: intl.formatMessage({
            id: getFeeLabel({ feeType: EFeeType.Custom }),
          }),
          value: items.length,
          feeInfo: customFeeInfo,
          type: EFeeType.Custom,
        });
      }

      return items;
    }

    return [];
  }, [
    customFee?.feeUTXO,
    customFee?.gas,
    customFee?.gasEIP1559,
    txFee,
    intl,
    sendSelectedFee.presetIndex,
    vaultSettings?.editFeeEnabled,
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

  const renderFeeEditor = useCallback(() => {
    if (!txFeeInit.current) {
      return <Skeleton height="$5" width="$12" />;
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
      <Popover
        title={intl.formatMessage({ id: 'title__edit_fee' })}
        open={isEditFeeActive}
        onOpenChange={setIsEditFeeActive}
        allowFlip={false}
        renderContent={
          <FeeEditor
            networkId={networkId}
            feeSelectorItems={feeSelectorItems}
            setIsEditFeeActive={setIsEditFeeActive}
            selectedFee={selectedFee}
            sendSelectedFee={sendSelectedFee}
            unsignedTxs={unsignedTxs}
            originalCustomFee={customFee}
            onApplyFeeInfo={handleApplyFeeInfo}
          />
        }
        renderTrigger={
          <FeeSelectorTrigger
            onPress={() => setIsEditFeeActive(true)}
            disabled={
              sendFeeStatus.status === ESendFeeStatus.Error ||
              !txFeeInit.current
            }
          />
        }
      />
    );
  }, [
    customFee,
    feeSelectorItems,
    handleApplyFeeInfo,
    intl,
    isEditFeeActive,
    networkId,
    openFeeEditorEnabled,
    selectedFee,
    sendFeeStatus.status,
    sendSelectedFee,
    unsignedTxs,
  ]);

  return (
    <Container.Box>
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
    </Container.Box>
  );
}
export default memo(TxFeeContainer);
