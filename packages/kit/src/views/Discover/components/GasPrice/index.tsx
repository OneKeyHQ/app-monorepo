import { useEffect } from 'react';

import { Box, Center, CustomSkeleton, Typography } from '@onekeyhq/components';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../../hooks';
import { setNetworkPrice } from '../../../../store/reducers/discover';

export const GasPrice = () => {
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
    <Center
      borderRadius={12}
      borderColor="border-subdued"
      borderWidth={1}
      w="12"
      h="12"
    >
      {price ? (
        <Typography.Body2Strong lineHeight={14} color="text-warning">
          {price}
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
