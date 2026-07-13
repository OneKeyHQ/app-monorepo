import { useCallback, useRef, useState } from 'react';

export type INetworkRestoreState = {
  isInternetReachable: boolean | null;
  restoreNonce: number;
};

export function useNetworkRestoreState(
  initialInternetReachable: boolean | null,
) {
  const offlineSinceLastReachableRef = useRef(
    initialInternetReachable === false,
  );
  const [networkState, setNetworkState] = useState<INetworkRestoreState>(
    () => ({
      isInternetReachable: initialInternetReachable,
      restoreNonce: 0,
    }),
  );

  const updateInternetReachable = useCallback(
    (nextInternetReachable: boolean | null) => {
      let shouldIncrementRestoreNonce = false;

      if (nextInternetReachable === false) {
        offlineSinceLastReachableRef.current = true;
      } else if (
        nextInternetReachable === true &&
        offlineSinceLastReachableRef.current
      ) {
        offlineSinceLastReachableRef.current = false;
        shouldIncrementRestoreNonce = true;
      }

      setNetworkState((prevState) => {
        const nextRestoreNonce = shouldIncrementRestoreNonce
          ? prevState.restoreNonce + 1
          : prevState.restoreNonce;

        if (
          prevState.isInternetReachable === nextInternetReachable &&
          prevState.restoreNonce === nextRestoreNonce
        ) {
          return prevState;
        }

        return {
          isInternetReachable: nextInternetReachable,
          restoreNonce: nextRestoreNonce,
        };
      });
    },
    [],
  );

  return {
    networkState,
    updateInternetReachable,
  };
}
