import { Spinner, Stack, Text, XStack } from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../../hooks/usePromiseResult';
import {
  calculateTotalFeeNative,
  calculateTotalFeeRange,
} from '../../../../utils/gasFee';

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

      const feeRange = calculateTotalFeeRange(r, r.nativeDecimals);
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
      <Stack padding="$2">
        <Spinner size="small" />
      </Stack>
    );

  return (
    <XStack padding="$2" space="$2">
      <Text>Gas Fee</Text>
      <Text>
        {gasFee.result?.totalNativeForDisplay}{' '}
        {gasFee.result?.feeInfo.nativeSymbol}
      </Text>
    </XStack>
  );
}
export { TxGasFeeContainer };
