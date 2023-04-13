import { Box } from '@onekeyhq/components';

import { useSwapChartMode } from '../../hooks/useSwapUtils';
import { LimitOrderMainButton } from '../Buttons/limitOrder';
import { PaddingControl } from '../PaddingControl';

import { MainContent } from './MainContent';
import { LimitOrderObserver } from './Observer';
import { ParameterSetting } from './ParameterSetting';
import { PendingSimpleContent } from './PendingContent';
import { PriceWarning } from './PriceWarning';

export function LimitOrderMain() {
  const mode = useSwapChartMode();
  return (
    <Box>
      <MainContent />
      <ParameterSetting />
      <PaddingControl>
        <Box my="6">
          <PriceWarning />
          <LimitOrderMainButton />
        </Box>
      </PaddingControl>
      {mode !== 'chart' ? <PendingSimpleContent /> : null}
      <LimitOrderObserver />
    </Box>
  );
}
