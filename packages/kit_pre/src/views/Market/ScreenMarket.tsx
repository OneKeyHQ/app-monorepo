import { Box, useSafeAreaInsets } from '@onekeyhq/components';

import MarketHeader from './Components/MarketList/MarketTopHeader';
import Market from './MarketList';

export function ScreenMarket() {
  const { top } = useSafeAreaInsets();
  return (
    <Box w="full" h="full" pt={`${top}px`}>
      <MarketHeader />
      <Market />
    </Box>
  );
}
