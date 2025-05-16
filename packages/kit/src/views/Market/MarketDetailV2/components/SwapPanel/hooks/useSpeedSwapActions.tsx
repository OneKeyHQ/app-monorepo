import { useCallback } from 'react';

export function useSpeedSwapActions() {
  const speedSwapSwitchType = useCallback(() => {}, []);
  const speedSwapBuildTx = useCallback(() => {}, []);
  return {
    speedSwapSwitchType,
    speedSwapBuildTx,
  };
}
