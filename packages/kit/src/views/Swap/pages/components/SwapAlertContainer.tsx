import { memo, useMemo } from 'react';

import { Alert } from '@onekeyhq/components';

import { useSwapActionState } from '../../hooks/useSwapState';

const SwapAlertContainer = () => {
  const swapActionState = useSwapActionState();
  const hasWrongMsg = useMemo(
    () => swapActionState?.alerts?.length,
    [swapActionState?.alerts?.length],
  );
  return hasWrongMsg ? (
    <>
      {swapActionState.alerts?.map((item) => (
        <Alert
          type="warning"
          description={item.message}
          icon="InfoCircleOutline"
        />
      ))}
    </>
  ) : null;
};

export default memo(SwapAlertContainer);
