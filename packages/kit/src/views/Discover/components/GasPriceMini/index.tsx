import { useEffect } from 'react';

import { Box, CustomSkeleton, Icon, Typography } from '@onekeyhq/components';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../../hooks';
import { setNetworkPrice } from '../../../../store/reducers/discover';

export const GasPriceMini = () => {
  const networkPrices = useAppSelector((s) => s.discover.networkPrices);
  const price = networkPrices?.[OnekeyNetwork.eth];
  useEffect(() => {
    async function handler() {
      const res = await backgroundApiProxy.serviceGas.getGasInfo({
        networkId: OnekeyNetwork.eth,
      });
      const item = res.prices[0];
      let value = '';
      if (typeof item === 'string') {
        value = item;
      } else {
        value = item.price ?? '';
      }
      backgroundApiProxy.dispatch(
        setNetworkPrice({ networkId: OnekeyNetwork.eth, price: value }),
      );
    }
    const t = setInterval(handler, 30 * 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <Box flexDirection="row" alignItems="center" h="full">
      {price ? (
        <Box flexDirection="row" alignItems="center">
          <Icon name="GasIllus" size={16} color="text-warning" />
          <Box ml="1">
            <Typography.Button2 color="text-warning">
              {price}
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
