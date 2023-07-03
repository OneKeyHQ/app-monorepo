import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import {
  Box,
  Center,
  HStack,
  RadioFee,
  Spinner,
  VStack,
} from '@onekeyhq/components';
import type { IGasInfo } from '@onekeyhq/engine/src/types/gas';
import type { EIP1559Fee } from '@onekeyhq/engine/src/types/network';
import type { IFeeInfo } from '@onekeyhq/engine/src/vaults/types';
import { estimateTxSize } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/provider/vsize';
import { coinSelect } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/utils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useNetworkSimple } from '../../hooks';
import { FeeSpeedLabel } from '../Send/components/FeeSpeedLabel';
import { FeeSpeedTime } from '../Send/components/FeeSpeedTime';
import { FeeSpeedTip } from '../Send/components/FeeSpeedTip';
import { SendEditFeeOverview } from '../Send/components/SendEditFeeOverview';

import { btcMockInputs, btcMockOutputs } from './config';

type Props = {
  selectedNetworkId: string;
  gasInfo: IGasInfo | null;
  isEIP1559Enabled: boolean;
} & ComponentProps<typeof Box>;

const presetItemStyle = {
  marginTop: 4,
  paddingLeft: '0px',
  paddingRight: '0px',
  paddingTop: '4px',
  paddingBottom: '4px',
  alignItems: 'center',
  height: '48px',
  bgColor: 'transparent',
};

function getPrice(price: string | EIP1559Fee, isEIP1559Enabled: boolean) {
  if (isEIP1559Enabled) {
    return price;
  }

  if (typeof price === 'object') {
    return price.gasPrice ?? price.price;
  }

  return price;
}

function GasList(props: Props) {
  const { selectedNetworkId, gasInfo, isEIP1559Enabled, ...rest } = props;
  const { prices } = gasInfo || {};
  const { serviceGas } = backgroundApiProxy;

  const [waitingSeconds, setWaitingSeconds] = useState<Array<number>>([]);

  const network = useNetworkSimple(selectedNetworkId);

  const gasItems = useMemo(() => {
    if (!prices || !network) return [];

    let limit = String(network?.settings.minGasLimit ?? 21000);
    limit = network?.settings.isBtcForkChain
      ? estimateTxSize(btcMockInputs, btcMockOutputs).toString()
      : limit;

    const feeInfo: IFeeInfo = {
      prices,
      defaultPresetIndex: '1',
      eip1559: isEIP1559Enabled,
      limit,
      feeDecimals: network.feeDecimals,
      nativeDecimals: network.decimals,
      isBtcForkChain: network.settings.isBtcForkChain,
      feeList: network?.settings.isBtcForkChain
        ? prices.map(
            (price) =>
              coinSelect({
                inputsForCoinSelect: btcMockInputs,
                outputsForCoinSelect: btcMockOutputs,
                feeRate: new BigNumber(price as string)
                  .shiftedBy(network.feeDecimals)
                  .toFixed(),
              }).fee,
          )
        : [],
    };

    const items = prices.map((price, index) => ({
      value: index.toString(),
      title: (
        <FeeSpeedLabel index={index} iconSize={28} space={2} prices={prices} />
      ),

      describe: (
        <HStack space="10px" alignItems="center">
          <VStack>
            <SendEditFeeOverview
              accountId=""
              networkId={selectedNetworkId}
              price={getPrice(price, isEIP1559Enabled)}
              feeInfo={feeInfo}
              limit={limit}
              currencyProps={{ typography: 'Body1', textAlign: 'right' }}
              onlyCurrency
            />
            <FeeSpeedTime
              index={index}
              waitingSeconds={waitingSeconds[index]}
            />
          </VStack>
          <FeeSpeedTip
            index={index}
            isEIP1559={isEIP1559Enabled}
            price={getPrice(price, isEIP1559Enabled)}
            limit={limit}
            feeInfo={feeInfo}
          />
        </HStack>
      ),
      ...presetItemStyle,
    }));

    return items;
  }, [isEIP1559Enabled, network, prices, selectedNetworkId, waitingSeconds]);

  useEffect(() => {
    const fetchTxWaitTime = async () => {
      const resp = await serviceGas.getTxWaitingSeconds({
        networkId: selectedNetworkId,
      });
      setWaitingSeconds(resp);
    };
    fetchTxWaitTime();
  }, [selectedNetworkId, serviceGas]);

  return (
    <Box {...rest}>
      {gasInfo ? (
        <RadioFee
          mt={2}
          padding="0px"
          items={gasItems}
          name="standard fee group"
        />
      ) : (
        <Center w="full" py={16}>
          <Spinner size="lg" />
        </Center>
      )}
    </Box>
  );
}

export { GasList };
