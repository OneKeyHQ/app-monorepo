import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp, ISelectItem } from '@onekeyhq/components';
import { SizableText, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Container } from '@onekeyhq/kit/src/components/Container';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import {
  useCustomFeeAtom,
  useNativeTokenTransferAmountAtom,
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
import { EFeeType, ESendFeeStatus } from '@onekeyhq/shared/types/fee';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';

import { GasSelector } from '../../components/GasSelector';
import { EModalSendRoutes } from '../../router';

import type { IModalSendParamList } from '../../router';

type IProps = {
  accountId: string;
  networkId: string;
};

function TxFeeContainer(props: IProps) {
  const { accountId, networkId } = props;
  const intl = useIntl();
  const txFeeInit = useRef(false);
  const [sendSelectedFee] = useSendSelectedFeeAtom();
  const [customFee] = useCustomFeeAtom();
  const [settings] = useSettingsPersistAtom();
  const [sendFeeStatus] = useSendFeeStatusAtom();
  const [sendAlertStatus] = useSendTxStatusAtom();
  const [nativeTokenTransferAmount] = useNativeTokenTransferAmountAtom();
  const [unsignedTxs] = useUnsignedTxsAtom();
  const {
    updateSendSelectedFee,
    updateCustomFee,
    updateSendSelectedFeeInfo,
    updateSendFeeStatus,
    updateSendTxStatus,
  } = useSendConfirmActions().current;
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();

  const {
    result: [isEditFeeEnabled, network, nativeToken] = [],
    isLoading: isLoadingNativeBalance,
  } = usePromiseResult(
    async () => {
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId,
        networkId,
      });

      if (!account) return;

      return Promise.all([
        backgroundApiProxy.serviceGas.getIsEditFeeEnabled({ networkId }),
        backgroundApiProxy.serviceNetwork.getNetwork({ networkId }),
        backgroundApiProxy.serviceToken.fetchTokensDetails({
          networkId,
          accountAddress: account.address,
          contractList: [''],
        }),
      ]);
    },
    [accountId, networkId],
    { watchLoading: true },
  );

  const { result: gasFee } = usePromiseResult(
    async () => {
      try {
        updateSendFeeStatus({
          status: ESendFeeStatus.Loading,
        });
        const r = await backgroundApiProxy.serviceGas.estimateFee({
          networkId,
          encodedTx: unsignedTxs[0].encodedTx,
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
    [networkId, unsignedTxs, updateSendFeeStatus],
    {
      pollingInterval: 6000,
    },
  );

  const feeSelectorItems = useMemo(() => {
    const items = [];
    if (gasFee) {
      const feeLength = (
        gasFee.gas ??
        gasFee.feeUTXO ??
        gasFee.gasEIP1559 ??
        []
      ).length;

      for (let i = 0; i < feeLength; i += 1) {
        const feeInfo: IFeeInfoUnit = {
          common: gasFee?.common,
          gas: gasFee.gas?.[i],
          gasEIP1559: gasFee.gasEIP1559?.[i],
          feeUTXO: gasFee.feeUTXO?.[i],
        };

        items.push({
          leading: (
            <SizableText fontSize={32}>
              {getFeeIcon({
                feeType: EFeeType.Standard,
                presetIndex: i,
              })}
            </SizableText>
          ),
          label: intl.formatMessage({
            id: getFeeLabel({ feeType: EFeeType.Standard, presetIndex: i }),
          }),
          value: String(i),
          feeInfo,
        });
      }

      if (isEditFeeEnabled) {
        const customFeeInfo: IFeeInfoUnit = {
          common: gasFee.common,
        };

        if (customFee?.gas && gasFee.gas) {
          customFeeInfo.gas = {
            ...customFee.gas,
            gasLimit: customFee.gas.gasLimit ?? gasFee.gas[0].gasLimit,
            gasLimitForDisplay:
              customFee.gas.gasLimitForDisplay ??
              gasFee.gas[0].gasLimitForDisplay,
          };
        }

        if (customFee?.gasEIP1559 && gasFee.gasEIP1559) {
          customFeeInfo.gasEIP1559 = {
            ...customFee.gasEIP1559,
            gasLimit:
              customFee.gasEIP1559.gasLimit ?? gasFee.gasEIP1559[0].gasLimit,
            gasLimitForDisplay:
              customFee.gasEIP1559.gasLimitForDisplay ??
              gasFee.gasEIP1559[0].gasLimitForDisplay,
          };
        }

        if (customFee?.feeUTXO && gasFee.feeUTXO) {
          customFeeInfo.feeUTXO = customFee.feeUTXO;
        }

        items.push({
          leading: (
            <SizableText fontSize={32}>
              {getFeeIcon({
                feeType: EFeeType.Custom,
              })}
            </SizableText>
          ),
          label: intl.formatMessage({
            id: getFeeLabel({ feeType: EFeeType.Custom }),
          }),
          value: EFeeType.Custom,
          feeInfo: customFeeInfo,
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
    isEditFeeEnabled,
  ]);

  const { selectedFee, feeSelectorValue } = useMemo(() => {
    let selectedFeeInfo;
    let selectorValue;

    if (isEmpty(feeSelectorItems)) return {};

    if (sendSelectedFee.feeType === EFeeType.Custom) {
      selectedFeeInfo = feeSelectorItems[feeSelectorItems.length - 1].feeInfo;
      selectorValue = EFeeType.Custom;
    } else {
      selectedFeeInfo = feeSelectorItems[sendSelectedFee.presetIndex].feeInfo;
      selectorValue = String(sendSelectedFee.presetIndex);
    }

    const { total, totalNative, totalNativeForDisplay, totalFiatForDisplay } =
      calculateFeeForSend({
        feeInfo: selectedFeeInfo,
        nativeTokenPrice: gasFee?.common.nativeTokenPrice ?? 0,
      });

    return {
      selectedFee: {
        feeInfo: selectedFeeInfo,
        total,
        totalNative,
        totalNativeForDisplay,
        totalFiatForDisplay,
      },
      feeSelectorValue: selectorValue,
    };
  }, [
    gasFee?.common.nativeTokenPrice,
    feeSelectorItems,
    sendSelectedFee.feeType,
    sendSelectedFee.presetIndex,
  ]);

  const handleSelectedFeeOnChange = useCallback(
    (value: string | ISelectItem) => {
      if (value === EFeeType.Custom) {
        navigation.pushModal(EModalRoutes.SendModal, {
          screen: EModalSendRoutes.SendCustomFee,
          params: {
            networkId,
            accountId: '',
            customFee: customFee ?? selectedFee?.feeInfo,
            onApply: (feeInfo: IFeeInfoUnit) => {
              updateCustomFee(feeInfo);
              updateSendSelectedFee({
                feeType: EFeeType.Custom,
                presetIndex: 0,
              });
            },
          },
        });
      } else {
        updateSendSelectedFee({
          feeType: EFeeType.Standard,
          presetIndex: Number(value),
        });
      }
    },
    [
      customFee,
      navigation,
      networkId,
      selectedFee?.feeInfo,
      updateCustomFee,
      updateSendSelectedFee,
    ],
  );

  useEffect(() => {
    if (selectedFee && selectedFee.feeInfo) {
      updateSendSelectedFeeInfo(selectedFee);
    }
  }, [selectedFee, updateSendSelectedFeeInfo]);

  useEffect(() => {
    if (!txFeeInit.current) return;
    updateSendTxStatus({
      isLoadingNativeBalance,
      isInsufficientNativeBalance: isLoadingNativeBalance
        ? false
        : new BigNumber(nativeTokenTransferAmount ?? 0)
            .plus(selectedFee?.totalNative ?? 0)
            .gt(nativeToken?.[0].balanceParsed ?? 0),
    });

    return () =>
      updateSendFeeStatus({ status: ESendFeeStatus.Idle, errMessage: '' });
  }, [
    isLoadingNativeBalance,
    nativeToken,
    nativeTokenTransferAmount,
    selectedFee?.totalNative,
    updateSendFeeStatus,
    updateSendTxStatus,
  ]);

  return (
    <Container.Box>
      <Container.Item
        title="Fee Estimate"
        content={`${selectedFee?.totalNativeForDisplay ?? '0.00'} ${
          gasFee?.common.nativeSymbol ?? ''
        }`}
        subContent={`${settings.currencyInfo.symbol}${
          selectedFee?.totalFiatForDisplay ?? '0.00'
        }`}
        contentAdd={
          <GasSelector
            items={feeSelectorItems}
            value={feeSelectorValue}
            onChange={handleSelectedFeeOnChange}
            disabled={
              sendFeeStatus.status === ESendFeeStatus.Loading ||
              sendFeeStatus.status === ESendFeeStatus.Error
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
