import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ISelectItem } from '@onekeyhq/components';
import { SizableText, Spinner, XStack, YStack } from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/gas';
import { EGasType } from '@onekeyhq/shared/types/gas';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../../hooks/usePromiseResult';
import {
  useCustomGasAtom,
  useSendConfirmActions,
  useSendSelectedGasAtom,
} from '../../../../states/jotai/contexts/send-confirm';
import {
  calculateFeeForSend,
  getGasIcon,
  getGasLabel,
} from '../../../../utils/gasFee';
import { GasSelector } from '../../components/GasSelector';

type IProps = {
  accountId: string;
  networkId: string;
  unsignedTxs: IUnsignedTxPro[];
};

function TxGasFeeContainer(props: IProps) {
  const { networkId, unsignedTxs } = props;
  const intl = useIntl();
  const [sendSelectedGas] = useSendSelectedGasAtom();
  const [customGas] = useCustomGasAtom();
  const { updateSendSelectedGas } = useSendConfirmActions().current;

  const { result: gasFee, isLoading } = usePromiseResult(
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
          nativeTokenPrice: gasFee.nativeTokenPrice.price,
        });
        items.push({
          leading: (
            <SizableText fontSize={32}>
              {getGasIcon({
                gasType: EGasType.Standard,
                gasPresetIndex: i,
              })}
            </SizableText>
          ),
          label: intl.formatMessage({
            id: getGasLabel({ gasType: EGasType.Standard, gasPresetIndex: i }),
          }),
          value: String(i),
          total,
          totalNative,
          totalNativeForDisplay,
          totalFiatForDisplay,
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
            {getGasIcon({
              gasType: EGasType.Custom,
            })}
          </SizableText>
        ),
        label: intl.formatMessage({
          id: getGasLabel({ gasType: EGasType.Custom }),
        }),
        value: EGasType.Custom,
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
    if (sendSelectedGas.gasType === EGasType.Custom) {
      return {
        selectedGas: gasSelectorItems[gasSelectorItems.length - 1],
        gasSelectorValue: EGasType.Custom,
      };
    }
    return {
      selectedGas: gasSelectorItems[sendSelectedGas.presetIndex],
      gasSelectorValue: String(sendSelectedGas.presetIndex),
    };
  }, [gasSelectorItems, sendSelectedGas]);

  const handleSelectedGasOnChange = useCallback(
    (value: string | ISelectItem) => {
      if (value === EGasType.Custom) {
        updateSendSelectedGas({
          gasType: EGasType.Custom,
          presetIndex: 0,
        });
      } else {
        updateSendSelectedGas({
          gasType: EGasType.Standard,
          presetIndex: Number(value),
        });
      }
    },
    [updateSendSelectedGas],
  );

  if (isLoading)
    return (
      <XStack py="$2">
        <Spinner size="small" />
      </XStack>
    );

  return (
    <XStack py="$2" justifyContent="space-around">
      <YStack flex={1}>
        <XStack alignItems="center" space="$1">
          <SizableText size="$bodyLg">{`${
            selectedGas?.totalNativeForDisplay ?? ''
          } ${gasFee?.common.nativeSymbol ?? ''}`}</SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">{`${
            selectedGas?.totalFiatForDisplay ?? ''
          }`}</SizableText>
        </XStack>
        <SizableText size="$bodyMd" color="$textSubdued">
          Fee Estimate
        </SizableText>
      </YStack>
      <GasSelector
        items={gasSelectorItems}
        value={gasSelectorValue}
        onChange={handleSelectedGasOnChange}
      />
    </XStack>
  );
}
export { TxGasFeeContainer };
