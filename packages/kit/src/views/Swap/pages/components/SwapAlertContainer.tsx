import { memo } from 'react';

import { Alert, YStack } from '@onekeyhq/components';

import { useSwapStepState } from '../../hooks/useSwapStepState';

const SwapAlertContainer = () => {
  const swapStepState = useSwapStepState();
  const hasWrongMsg =
    (swapStepState.wrongMsg || swapStepState.rateWarning) &&
    !swapStepState.isLoading;
  return hasWrongMsg ? (
    <YStack>
      {swapStepState.wrongMsg ? (
        <Alert description={swapStepState.wrongMsg} icon="PlaceholderOutline" />
      ) : null}
      {swapStepState.rateWarning ? (
        <Alert
          description={swapStepState.rateWarning}
          icon="PlaceholderOutline"
        />
      ) : null}
    </YStack>
  ) : null;
};

export default memo(SwapAlertContainer);
