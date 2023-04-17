import { Box, useIsVerticalLayout } from '@onekeyhq/components';

import { useSwapChartMode } from '../../hooks/useSwapUtils';
import { LimitOrderMainButton } from '../Buttons/limitOrder';
import { PaddingControl } from '../PaddingControl';

import { MainContent } from './MainContent';
import { ParameterSetting } from './ParameterSetting';
import { PendingLimitOrdersSimpleContent } from './PendingContent';
import { PriceWarning } from './PriceWarning';

export function LimitOrderMain() {
  const mode = useSwapChartMode();
  const isSmall = useIsVerticalLayout();
  return (
    <Box>
      <Box borderRadius={isSmall ? undefined : '12'} overflow="hidden">
        <MainContent />
        <ParameterSetting />
      </Box>
      <PaddingControl>
        <Box my="6">
          <PriceWarning />
          <LimitOrderMainButton />
        </Box>
      </PaddingControl>
      {mode !== 'chart' ? <PendingLimitOrdersSimpleContent /> : null}
    </Box>
  );
}
