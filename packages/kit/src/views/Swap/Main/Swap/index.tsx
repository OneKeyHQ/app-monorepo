import { Box } from '@onekeyhq/components';

import { MainButton, SwapButton } from '../MainButton';
import { PaddingControl } from '../PaddingControl';

import { SwapAlert } from './SwapAlert';
import { SwapContent } from './SwapContent';
import { SwapQuote } from './SwapQuote';

export function SwapMain() {
  return (
    <Box>
      <SwapContent />
      <PaddingControl>
        <SwapAlert />
        <Box mt="6" mb="3">
          <MainButton>
            <SwapButton />
          </MainButton>
        </Box>
        <SwapQuote />
      </PaddingControl>
    </Box>
  );
}
