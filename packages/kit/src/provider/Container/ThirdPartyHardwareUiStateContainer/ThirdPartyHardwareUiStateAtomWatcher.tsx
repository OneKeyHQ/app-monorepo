import { memo, useEffect } from 'react';

import {
  useThirdPartyAppInstallAtom,
  useThirdPartyBatchInstallAtom,
  useThirdPartyHardwareUiStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/hardware';

function ThirdPartyHardwareUiStateAtomWatcherCmp({
  onShouldMount,
}: {
  onShouldMount: () => void;
}) {
  const [uiState] = useThirdPartyHardwareUiStateAtom();
  const [appInstallState] = useThirdPartyAppInstallAtom();
  const [batchInstallState] = useThirdPartyBatchInstallAtom();

  useEffect(() => {
    if (uiState || appInstallState || batchInstallState) {
      onShouldMount();
    }
  }, [appInstallState, batchInstallState, onShouldMount, uiState]);

  return null;
}

export const ThirdPartyHardwareUiStateAtomWatcher = memo(
  ThirdPartyHardwareUiStateAtomWatcherCmp,
);
