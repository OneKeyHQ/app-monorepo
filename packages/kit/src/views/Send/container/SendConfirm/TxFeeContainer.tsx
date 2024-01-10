import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ISelectItem } from '@onekeyhq/components';
import { SizableText, Spinner, XStack, YStack } from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/gas';
import { EFeeType } from '@onekeyhq/shared/types/gas';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../../hooks/usePromiseResult';
import {
  useCustomFeeAtom,
  useSendConfirmActions,
  useSendSelectedFeeAtom,
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

function TxFeeContainer(props: IProps) {
  const { networkId, unsignedTxs } = props;
  const intl = useIntl();
  const [sendSelectedFee] = useSendSelectedFeeAtom();
  const [customFee] = useCustomFeeAtom();
  const { updateSendSelectedFee } = useSendConfirmActions().current;

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
                gasType: EFeeType.Standard,
                gasPresetIndex: i,
              })}
            </SizableText>
          ),
          label: intl.formatMessage({
            id: getGasLabel({ gasType: EFeeType.Standard, gasPresetIndex: i }),
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
              gasType: EFeeType.Custom,
            })}
          </SizableText>
        ),
        label: intl.formatMessage({
          id: getGasLabel({ gasType: EFeeType.Custom }),
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

  const handleSelectedGasOnChange = useCallback(
    (value: string | ISelectItem) => {
      if (value === EFeeType.Custom) {
        updateSendSelectedFee({
          feeType: EFeeType.Custom,
          presetIndex: 0,
        });
      } else {
        updateSendSelectedFee({
          feeType: EFeeType.Standard,
          presetIndex: Number(value),
        });
      }
    },
    [updateSendSelectedFee],
  );

  if (isLoading)
    return (
      <XStack py="$2">
        <Spinner size="small" />
      </XStack>
    );

  return (
    <XStack py="$2" alignItems="center" justifyContent="space-around">
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
export { TxFeeContainer };
