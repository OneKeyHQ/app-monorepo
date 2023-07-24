import { type ComponentProps } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Box, HStack, Text } from '@onekeyhq/components';
import type { IGasInfo } from '@onekeyhq/engine/src/types/gas';
import type { EIP1559Fee } from '@onekeyhq/engine/src/types/network';
import { NetworkCongestionThresholds } from '@onekeyhq/engine/src/types/network';

import { useNetworkSimple } from '../../hooks';

import { networkPendingTransactionThresholds } from './config';

type Props = {
  gasInfo: IGasInfo | null;
  selectedNetworkId: string;
  isEIP1559Enabled: boolean;
} & ComponentProps<typeof Box>;

enum GasLevel {
  low = 'low',
  stable = 'stable',
  busy = 'busy',
}

const feeSpeedLabel = ['🍃', '☕️', '🔥'];

function getGasLevelFromNetworkCongestion(networkCongestion: number) {
  if (networkCongestion < NetworkCongestionThresholds.stable) {
    return GasLevel.low;
  }
  if (
    networkCongestion >= NetworkCongestionThresholds.stable &&
    networkCongestion < NetworkCongestionThresholds.busy
  ) {
    return GasLevel.stable;
  }
  return GasLevel.busy;
}
function getGasLevelFromEstimatedTransactionCount({
  estimatedTransactionCount,
  networkId,
}: {
  estimatedTransactionCount: number;
  networkId: string;
}) {
  if (
    estimatedTransactionCount <
    networkPendingTransactionThresholds[networkId].stable
  ) {
    return GasLevel.low;
  }
  if (
    estimatedTransactionCount >=
      networkPendingTransactionThresholds[networkId].stable &&
    estimatedTransactionCount <
      networkPendingTransactionThresholds[networkId].busy
  ) {
    return GasLevel.stable;
  }
  return GasLevel.busy;
}
function getGasLevelInfo(gasLevel: GasLevel) {
  switch (gasLevel) {
    case GasLevel.low:
      return {
        label: feeSpeedLabel[0],
      };
    case GasLevel.stable:
      return {
        label: feeSpeedLabel[1],
      };
    case GasLevel.busy:
      return {
        label: feeSpeedLabel[2],
      };
    default:
      return {
        label: feeSpeedLabel[1],
      };
  }
}

function GasOverview(props: Props) {
  const { gasInfo, selectedNetworkId, isEIP1559Enabled, ...rest } = props;
  const { estimatedTransactionCount, networkCongestion, prices } =
    gasInfo || {};

  const intl = useIntl();

  const network = useNetworkSimple(selectedNetworkId);

  if (!gasInfo) return null;

  if (
    networkCongestion === undefined &&
    estimatedTransactionCount === undefined
  )
    return null;

  const price = prices?.[0];
  let gasLevel: GasLevel = GasLevel.stable;

  if (networkCongestion) {
    gasLevel = getGasLevelFromNetworkCongestion(networkCongestion);
  } else if (estimatedTransactionCount) {
    gasLevel = getGasLevelFromEstimatedTransactionCount({
      estimatedTransactionCount,
      networkId: selectedNetworkId,
    });
  }

  const gasLevelInfo = getGasLevelInfo(gasLevel);

  return (
    <Box {...rest}>
      <Text fontSize={56} textAlign="center">
        {gasLevelInfo.label}
      </Text>
      <Text typography="DisplayMedium" textAlign="center">
        {intl.formatMessage({ id: 'title__current_gas_fee' })}
      </Text>
      {isEIP1559Enabled ? (
        <HStack alignItems="center" mt={1} justifyContent="center">
          <Text color="text-subdued">
            {`${intl.formatMessage({ id: 'form__base_fee' })}: ${new BigNumber(
              (price as EIP1559Fee)?.baseFee ?? 0,
            ).toFixed(2)} ${network?.feeSymbol ?? ''}`}
          </Text>
        </HStack>
      ) : (
        <Text typography="Body2" mt={1} color="text-subdued" textAlign="center">
          {intl.formatMessage(
            { id: 'title__current_gas_fee_desc' },
            { '0': network?.symbol || '' },
          )}
        </Text>
      )}
    </Box>
  );
}

export { GasOverview };
