import { SizableText, Spinner, XStack, YStack } from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  calculateTotalFeeNative,
  calculateTotalFeeRange,
} from '@onekeyhq/kit/src/utils/gasFee';
import { GasSelectorTrigger } from '../../components/GasSelector/GasSelectorTrigger';

type IProps = {
  accountId: string;
  networkId: string;
  unsignedTxs: IUnsignedTxPro[];
};

const DEFAULT_PRESET_INDEX = 1;

function TxGasFeeContainer(props: IProps) {
  const { networkId, unsignedTxs } = props;

  const gasFee = usePromiseResult(
    async () => {
      const r = await backgroundApiProxy.serviceGas.fetchFeeInfoUnit({
        networkId,
        encodedTx: unsignedTxs[0].encodedTx,
        presetIndex: DEFAULT_PRESET_INDEX,
      });

      const feeRange = calculateTotalFeeRange(r, r.common?.nativeDecimals);
      const total = feeRange.max;
      const totalForDisplay = feeRange.maxForDisplay;
      const totalNative = calculateTotalFeeNative({
        amount: total,
        feeInfo: r,
      });
      const totalNativeForDisplay = calculateTotalFeeNative({
        amount: totalForDisplay,
        feeInfo: r,
      });

      return {
        feeInfo: r,
        totalNative,
        totalNativeForDisplay,
      };
    },
    [networkId, unsignedTxs],
    {
      watchLoading: true,
    },
  );

  if (gasFee.isLoading)
    return (
      <XStack py="$2">
        <Spinner size="small" />
      </XStack>
    );

  return (
    <XStack py="$2" justifyContent="space-around">
      <YStack flex={1}>
        <SizableText size="$bodyLg">{`${
          gasFee.result?.totalNativeForDisplay ?? ''
        } ${gasFee.result?.feeInfo.common?.nativeSymbol ?? ''}`}</SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          Fee Estimate
        </SizableText>
      </YStack>
      <GasSelectorTrigger flex={1} justifyContent="flex-end" />
    </XStack>
  );
}
export { TxGasFeeContainer };
