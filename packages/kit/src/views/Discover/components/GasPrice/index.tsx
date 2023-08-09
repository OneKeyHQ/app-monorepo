import { useEffect } from 'react';

import {
  Box,
  Center,
  CustomSkeleton,
  Icon,
  Typography,
} from '@onekeyhq/components';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../../hooks';
import { setNetworkPrice } from '../../../../store/reducers/discover';
import { selectDiscoverNetworkPrices } from '../../../../store/selectors';

class GasPriceUpdater {
  private loading = false;

  static instance = new GasPriceUpdater();

  async refresh() {
    if (this.loading) {
      return;
    }
    try {
      this.loading = true;
      const res = await backgroundApiProxy.serviceGas.getGasInfo({
        networkId: OnekeyNetwork.eth,
      });
      const item = res.prices[0];
      let value = '';
      if (typeof item === 'string') {
        value = item;
      } else {
        value = item.price || Number(item.baseFee).toFixed(0) || '';
      }
      backgroundApiProxy.dispatch(
        setNetworkPrice({ networkId: OnekeyNetwork.eth, price: value }),
      );
    } finally {
      this.loading = false;
    }
  }
}

export const GasPrice = () => {
  const networkPrices = useAppSelector(selectDiscoverNetworkPrices);
  const price = networkPrices?.[OnekeyNetwork.eth];
  useEffect(() => {
    GasPriceUpdater.instance.refresh();
    const t = setInterval(() => GasPriceUpdater.instance.refresh(), 60 * 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <Center
      borderRadius={12}
      borderColor="border-subdued"
      borderWidth={1}
      w="12"
      h="12"
    >
      {price ? (
        <Typography.Body2Strong lineHeight={14} color="text-warning">
          {Math.ceil(Number(price))}
        </Typography.Body2Strong>
      ) : (
        <Box w="8" h="3" mb="1" overflow="hidden" borderRadius={12}>
          <CustomSkeleton />
        </Box>
      )}
      <Typography.CaptionStrong lineHeight={12} color="text-warning">
        Gwei
      </Typography.CaptionStrong>
    </Center>
  );
};

export const GasPriceMini = () => {
  const networkPrices = useAppSelector(selectDiscoverNetworkPrices);
  const price = networkPrices?.[OnekeyNetwork.eth];
  useEffect(() => {
    const t = setInterval(() => GasPriceUpdater.instance.refresh(), 60 * 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <Box flexDirection="row" alignItems="center" h="full">
      {price ? (
        <Box flexDirection="row" alignItems="center">
          <Icon name="GasIllus" size={16} color="text-warning" />
          <Box ml="1">
            <Typography.Button2 color="text-warning">
              {Math.ceil(Number(price))}
            </Typography.Button2>
          </Box>
        </Box>
      ) : (
        <Box w="8" h="3" mb="1" overflow="hidden" borderRadius={12}>
          <CustomSkeleton />
        </Box>
      )}
    </Box>
  );
};
