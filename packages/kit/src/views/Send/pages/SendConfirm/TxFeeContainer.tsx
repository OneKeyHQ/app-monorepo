import { useCallback, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IPageNavigationProp, ISelectItem } from '@onekeyhq/components';
import { SizableText } from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Container } from '@onekeyhq/kit/src/components/Container';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import {
  useCustomFeeAtom,
  useSendConfirmActions,
  useSendSelectedFeeAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/send-confirm';
import {
  calculateFeeForSend,
  getFeeIcon,
  getFeeLabel,
} from '@onekeyhq/kit/src/utils/gasFee';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EFeeType } from '@onekeyhq/shared/types/gas';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/gas';

import { GasSelector } from '../../components/GasSelector';
import { EModalSendRoutes } from '../../router';

import type { IModalSendParamList } from '../../router';

type IProps = {
  accountId: string;
  networkId: string;
  unsignedTxs: IUnsignedTxPro[];
};

function TxFeeContainer(props: IProps) {
  const { networkId, unsignedTxs } = props;
  const intl = useIntl();
  const [sendSelectedFee] = useSendSelectedFeeAtom();
  const [customFee] = useCustomFeeAtom();
  const [settings] = useSettingsPersistAtom();
  const { updateSendSelectedFee, updateCustomFee, updateSendSelectedFeeInfo } =
    useSendConfirmActions().current;
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();

  const { result: gasFee } = usePromiseResult(
    async () => {
      const r = await backgroundApiProxy.serviceGas.estimateGasFee({
        networkId,
        encodedTx: unsignedTxs[0].encodedTx,
      });
      return r;
    },
    [networkId, unsignedTxs],
    {
      watchLoading: true,
    },
  );

  const gasSelectorItems = useMemo(() => {
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
        const {
          total,
          totalNative,
          totalNativeForDisplay,
          totalFiatForDisplay,
        } = calculateFeeForSend({
          feeInfo,
          nativeTokenPrice: gasFee.common.nativeTokenPrice,
        });
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
          total,
          totalNative,
          totalNativeForDisplay,
          totalFiatForDisplay,
          feeInfo,
        });
      }

      // TODO add custom entry by network setting
      // const customFeeInfo: IFeeInfoUnit = {
      //   common: {
      //     ...gasFee.common,
      //     limit: customGas?.gasLimit,
      //     limitForDisplay: customGas?.gasLimit,
      //   },
      //   gas: customGas?.gas,
      //   gasEIP1559: customGas?.gasEIP1559,
      //   feeUTXO: customGas?.feeUTXO,
      // };

      // const { total, totalNative, totalNativeForDisplay, totalFiatForDisplay } =
      //   calculateFeeForSend({
      //     feeInfo: customFeeInfo,
      //     nativeTokenPrice: gasFee.nativeTokenPrice.price,
      //   });
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
        // total,
        // totalNative,
        // totalNativeForDisplay,
        // totalFiatForDisplay,
      });

      return items;
    }

    return [];
  }, [gasFee, intl]);

  const { selectedGas, gasSelectorValue } = useMemo(() => {
    if (sendSelectedFee.feeType === EFeeType.Custom) {
      return {
        selectedGas: gasSelectorItems[gasSelectorItems.length - 1],
        gasSelectorValue: EFeeType.Custom,
      };
    }
    return {
      selectedGas: gasSelectorItems[sendSelectedFee.presetIndex],
      gasSelectorValue: String(sendSelectedFee.presetIndex),
    };
  }, [gasSelectorItems, sendSelectedFee]);

  useEffect(() => {
    if (selectedGas?.feeInfo) {
      updateSendSelectedFeeInfo(selectedGas.feeInfo);
    }
  }, [selectedGas?.feeInfo, updateSendSelectedFeeInfo]);

  const handleSelectedFeeOnChange = useCallback(
    (value: string | ISelectItem) => {
      if (value === EFeeType.Custom) {
        navigation.pushModal(EModalRoutes.SendModal, {
          screen: EModalSendRoutes.SendCustomFee,
          params: {
            networkId,
            accountId: '',
            customFee: customFee ?? (selectedGas.feeInfo as IFeeInfoUnit),
            onApply: (feeInfo: IFeeInfoUnit) => {
              updateSendSelectedFee({
                feeType: EFeeType.Custom,
                presetIndex: 0,
              });
              updateCustomFee(feeInfo);
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
      selectedGas?.feeInfo,
      updateCustomFee,
      updateSendSelectedFee,
    ],
  );

  return (
    <Container.Box>
      <Container.Item
        title="Fee Estimate"
        content={`${selectedGas?.totalNativeForDisplay ?? '0.00'} ${
          gasFee?.common.nativeSymbol ?? ''
        }`}
        subContent={`${settings.currencyInfo.symbol}${
          selectedGas?.totalFiatForDisplay ?? '0.00'
        }`}
        contentAdd={
          <GasSelector
            items={gasSelectorItems}
            value={gasSelectorValue}
            onChange={handleSelectedFeeOnChange}
          />
        }
      />
    </Container.Box>
  );
}
export { TxFeeContainer };
