import { memo, useMemo } from 'react';

import { Alert, YStack } from '@onekeyhq/components';

import { useSwapActionState } from '../../hooks/useSwapState';

const SwapAlertContainer = () => {
  const swapActionState = useSwapActionState();
  const hasWrongMsg = useMemo(
    () => swapActionState?.alerts?.length,
    [swapActionState?.alerts?.length],
  );
  return hasWrongMsg ? (
    <YStack space="$2">
      {swapActionState.alerts?.map((item) => (
        <Alert
          type="warning"
          description={item.message}
          icon="InfoCircleOutline"
        />
      ))}
    </YStack>
  ) : null;
};

export default memo(SwapAlertContainer);
