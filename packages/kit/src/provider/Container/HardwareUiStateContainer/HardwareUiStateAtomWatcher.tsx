import { memo, useEffect } from 'react';

import { useHardwareUiStateAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/hardware';

function HardwareUiStateAtomWatcherCmp({
  onShouldMount,
}: {
  onShouldMount: () => void;
}) {
  const [state] = useHardwareUiStateAtom();

  useEffect(() => {
    if (state) {
      onShouldMount();
    }
  }, [onShouldMount, state]);

  return null;
}

export const HardwareUiStateAtomWatcher = memo(HardwareUiStateAtomWatcherCmp);
