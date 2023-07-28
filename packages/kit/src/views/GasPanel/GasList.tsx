import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import {
  Box,
  Center,
  HStack,
  RadioFee,
  Spinner,
  Text,
  VStack,
} from '@onekeyhq/components';
import type { IGasInfo } from '@onekeyhq/engine/src/types/gas';
import type { EIP1559Fee } from '@onekeyhq/engine/src/types/network';
import type { IFeeInfo } from '@onekeyhq/engine/src/vaults/types';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useNetworkSimple } from '../../hooks';
import { FeeSpeedLabel } from '../Send/components/FeeSpeedLabel';
import { FeeSpeedTip } from '../Send/components/FeeSpeedTip';
import { SendEditFeeOverview } from '../Send/components/SendEditFeeOverview';

import { btcMockLimit } from './config';

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

const gasSpeedColor = ['decorative-icon-three', 'text-warning', 'text-success'];

function GasPriceLabel({
  index,
  price,
  feeInfo,
}: {
  index: number;
  price: string | EIP1559Fee;
  feeInfo: IFeeInfo;
}) {
  const priceLabel = useMemo(() => {
    if (feeInfo.isBtcForkChain) {
      return `${new BigNumber(price as string)
        .shiftedBy(feeInfo?.feeDecimals ?? 8)
        .toFixed()}`;
    }

    if (typeof price === 'string') {
      return price;
    }
    return price.gasPrice ?? price.price;
  }, [feeInfo?.feeDecimals, feeInfo.isBtcForkChain, price]);

  const feeSymbol = useMemo(() => {
    if (feeInfo.isBtcForkChain) {
      return 'sat/vB';
    }

    return feeInfo.feeSymbol;
  }, [feeInfo.feeSymbol, feeInfo.isBtcForkChain]);

  return (
    <Text typography="Body1Strong" color={gasSpeedColor[index]}>
      {`${priceLabel ?? ''} ${feeSymbol ?? ''}`}
    </Text>
  );
}

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

  const isFeeRateMode =
    network?.settings.isFeeRateMode || network?.settings.isBtcForkChain;

  const gasItems = useMemo(() => {
    if (!prices || !network) return [];

    let limit = String(network?.settings.minGasLimit ?? 21000);
    limit = isFeeRateMode ? btcMockLimit : limit;

    const feeInfo: IFeeInfo = {
      prices,
      defaultPresetIndex: '1',
      eip1559: isEIP1559Enabled && !isFeeRateMode,
      limit,
      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,
      nativeDecimals: network.decimals,
      isBtcForkChain: isFeeRateMode,
      feeList: isFeeRateMode
        ? prices
            .map((price) =>
              new BigNumber(price as string)
                .times(limit)
                .shiftedBy(network.decimals)
                .toNumber(),
            )
            .filter(Boolean)
        : [],
    };

    const items = prices.map((price, index) => ({
      value: index.toString(),
      title: (
        <FeeSpeedLabel
          index={index}
          iconSize={28}
          space={3}
          prices={prices}
          waitingSeconds={waitingSeconds[index]}
          withSpeedTime
        />
      ),

      describe: (
        <HStack space="10px" alignItems="center">
          <VStack>
            <GasPriceLabel price={price} index={index} feeInfo={feeInfo} />
            <SendEditFeeOverview
              accountId=""
              networkId={selectedNetworkId}
              price={getPrice(price, isEIP1559Enabled && !isFeeRateMode)}
              feeInfo={feeInfo}
              limit={limit}
              currencyProps={{
                typography: 'Body2',
                textAlign: 'right',
                color: 'text-subdued',
              }}
              formatOptions={{
                fixed: selectedNetworkId === OnekeyNetwork.polygon ? 4 : 2,
              }}
              onlyCurrency
            />
          </VStack>
          <FeeSpeedTip
            index={index}
            isEIP1559={isEIP1559Enabled && !isFeeRateMode}
            price={getPrice(price, isEIP1559Enabled && !isFeeRateMode)}
            limit={limit}
            feeInfo={feeInfo}
          />
        </HStack>
      ),
      ...presetItemStyle,
    }));

    return items;
  }, [
    isFeeRateMode,
    isEIP1559Enabled,
    network,
    prices,
    selectedNetworkId,
    waitingSeconds,
  ]);

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
