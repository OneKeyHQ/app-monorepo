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
        <Box my="6">
          <MainButton>
            <SwapButton />
          </MainButton>
        </Box>
        <SwapQuote />
      </PaddingControl>
    </Box>
  );
}
