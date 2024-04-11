import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';
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
  const { updateSendSelectedFeeInfo, updateSendFeeStatus, updateSendTxStatus } =
    useSendConfirmActions().current;

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

  const { result: gasFee } = usePromiseResult(
    async () => {
      try {
        updateSendFeeStatus({
          status: ESendFeeStatus.Loading,
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
          errMessage: (e as Error)?.message ?? e,
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

  const feeSelectorItems: IFeeSelectorItem[] = useMemo(() => {
    const items = [];
    if (gasFee) {
      const feeLength =
        gasFee.gasEIP1559?.length ||
        gasFee.gas?.length ||
        gasFee.feeUTXO?.length ||
        0;

      for (let i = 0; i < feeLength; i += 1) {
        const feeInfo: IFeeInfoUnit = {
          common: gasFee?.common,
          gas: gasFee.gas?.[i],
          gasEIP1559: gasFee.gasEIP1559?.[i],
          feeUTXO: gasFee.feeUTXO?.[i],
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

      if (vaultSettings?.editFeeEnabled) {
        const customFeeInfo: IFeeInfoUnit = {
          common: gasFee.common,
        };

        if (customFee?.gas && gasFee.gas) {
          customFeeInfo.gas = {
            ...customFee.gas,
            gasLimit:
              customFee.gas.gasLimit ??
              gasFee.gas[sendSelectedFee.presetIndex].gasLimit,
            gasLimitForDisplay:
              customFee.gas.gasLimitForDisplay ??
              gasFee.gas[sendSelectedFee.presetIndex].gasLimitForDisplay,
          };
        }

        if (customFee?.gasEIP1559 && gasFee.gasEIP1559) {
          customFeeInfo.gasEIP1559 = {
            ...customFee.gasEIP1559,
            gasLimit:
              customFee.gasEIP1559.gasLimit ??
              gasFee.gasEIP1559[sendSelectedFee.presetIndex].gasLimit,
            gasLimitForDisplay:
              customFee.gasEIP1559.gasLimitForDisplay ??
              gasFee.gasEIP1559[sendSelectedFee.presetIndex].gasLimitForDisplay,
          };
        }

        if (customFee?.feeUTXO && gasFee.feeUTXO) {
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
    gasFee,
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
      selectedFeeInfo = feeSelectorItems[sendSelectedFee.presetIndex].feeInfo;
    }

    const {
      total,
      totalNative,
      totalFiat,
      totalNativeForDisplay,
      totalFiatForDisplay,
    } = calculateFeeForSend({
      feeInfo: selectedFeeInfo,
      nativeTokenPrice: gasFee?.common.nativeTokenPrice ?? 0,
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
    gasFee?.common.nativeTokenPrice,
    unsignedTxs,
  ]);

  const handleFeeSelectorTriggerOnPress = useCallback(() => {
    if (!txFeeInit.current) return;
    setIsEditFeeActive((prev) => !prev);
  }, []);

  useEffect(() => {
    if (selectedFee && selectedFee.feeInfo) {
      updateSendSelectedFeeInfo(selectedFee);
    }
  }, [selectedFee, updateSendSelectedFeeInfo]);

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

  return (
    <Container.Box>
      <Container.Item
        title="Fee Estimate"
        content={
          txFeeInit.current ? (
            <NumberSizeableText
              formatter="balance"
              formatterOptions={{
                tokenSymbol: gasFee?.common.nativeSymbol,
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
        contentAdd={
          <Popover
            title={intl.formatMessage({ id: 'title__edit_fee' })}
            open={isEditFeeActive}
            onOpenChange={handleFeeSelectorTriggerOnPress}
            renderContent={
              <FeeEditor
                networkId={networkId}
                feeSelectorItems={feeSelectorItems}
                setIsEditFeeActive={setIsEditFeeActive}
              />
            }
            renderTrigger={
              <FeeSelectorTrigger
                onPress={handleFeeSelectorTriggerOnPress}
                disabled={
                  sendFeeStatus.status === ESendFeeStatus.Error ||
                  !txFeeInit.current
                }
              />
            }
          />
        }
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
