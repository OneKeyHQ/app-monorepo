import { memo, useEffect } from 'react';

import {
  useThirdPartyAppInstallAtom,
  useThirdPartyBatchInstallAtom,
  useThirdPartyBleBindingAtom,
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

  const [bindingState] = useThirdPartyBleBindingAtom();
  const hasPendingBleBinding =
    bindingState?.status === 'scanning' || bindingState?.status === 'verifying';

  useEffect(() => {
    if (
      uiState ||
      appInstallState ||
      batchInstallState ||
      hasPendingBleBinding
    ) {
      onShouldMount();
    }
  }, [
    appInstallState,
    batchInstallState,
    hasPendingBleBinding,
    onShouldMount,
    uiState,
  ]);

  return null;
}

export const ThirdPartyHardwareUiStateAtomWatcher = memo(
  ThirdPartyHardwareUiStateAtomWatcherCmp,
);
