import { type ComponentProps, useMemo } from 'react';

import { BigNumber } from 'bignumber.js';
import { map } from 'lodash';
import { useIntl } from 'react-intl';

import { Box, HStack, Text } from '@onekeyhq/components';
import type { IGasInfo } from '@onekeyhq/engine/src/types/gas';
import type { EIP1559Fee } from '@onekeyhq/engine/src/types/network';
import { NetworkCongestionThresholds } from '@onekeyhq/engine/src/types/network';
import { calculateTotalFeeRange } from '@onekeyhq/engine/src/vaults/utils/feeInfoUtils';

import { FormatCurrencyNativeOfAccount } from '../../components/Format';
import { useActiveWalletAccount, useNetworkSimple } from '../../hooks';

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

  const { accountId } = useActiveWalletAccount();

  const network = useNetworkSimple(selectedNetworkId);

  const totalNative = useMemo(() => {
    if (isEIP1559Enabled && network) {
      const priceLength = prices?.length || 1;
      const averageBaseFee = BigNumber.sum(
        ...map(prices as Array<EIP1559Fee>, 'baseFee'),
      )
        .dividedBy(priceLength)
        .toFixed();
      const averageMaxFee = BigNumber.sum(
        ...map(prices as Array<EIP1559Fee>, 'maxFeePerGas'),
      )
        .dividedBy(priceLength)
        .toFixed();
      const averageMaxPriorityFee = BigNumber.sum(
        ...map(prices as Array<EIP1559Fee>, 'maxPriorityFeePerGas'),
      )
        .dividedBy(priceLength)
        .toFixed();
      const limit = String(network.settings.minGasLimit || 21000);
      const total = calculateTotalFeeRange({
        eip1559: true,
        price1559: {
          baseFee: averageBaseFee,
          maxFeePerGas: averageMaxFee,
          maxPriorityFeePerGas: averageMaxPriorityFee,
        },
        limit,
      }).max;
      return new BigNumber(total)
        .shiftedBy(network.feeDecimals ?? 0)
        .shiftedBy(-(network.decimals ?? 0))
        .toFixed(8);
    }
    return '0';
  }, [isEIP1559Enabled, network, prices]);

  if (!gasInfo) return null;

  if (
    networkCongestion === undefined &&
    estimatedTransactionCount === undefined
  )
    return null;

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
            {' '}
            {intl.formatMessage({ id: 'form__max_fee' })}:
          </Text>
          <FormatCurrencyNativeOfAccount
            networkId={selectedNetworkId}
            accountId={accountId}
            value={totalNative}
            formatOptions={{
              fixed: 4,
            }}
            render={(ele) => <Text color="text-subdued">{ele}</Text>}
          />
          <Text color="text-subdued">{`(${totalNative} ${
            network?.symbol || ''
          })`}</Text>
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
