import { Box, useSafeAreaInsets } from '@onekeyhq/components';

import Market from './MarketList';

export function ScreenMarket() {
  const { top } = useSafeAreaInsets();
  console.log('top', top);
  return (
    <Box w="full" h="full" pt={`${top}px`}>
      <Market />
    </Box>
  );
}
