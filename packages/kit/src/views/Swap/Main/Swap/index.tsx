import { Box } from '@onekeyhq/components';

import { useAppSelector } from '../../../../hooks';
import { SwapMainButton } from '../Buttons/swap';
import { PaddingControl } from '../PaddingControl';

import { SwapAlert } from './SwapAlert';
import { SwapContent } from './SwapContent';
import { SwapQuote } from './SwapQuote';

export function SwapMain() {
  const loading = useAppSelector((s) => s.swap.loading);
  return (
    <Box>
      <SwapContent />
      <PaddingControl>
        <SwapAlert />
        <Box mt="6" mb="3">
          <SwapMainButton />
        </Box>
        {!loading ? <SwapQuote /> : null}
      </PaddingControl>
    </Box>
  );
}
