import { memo, useCallback, useEffect, useState } from 'react';

import { Stack } from '@onekeyhq/components';

const ref: {
  statusChange?: (isOpen: boolean) => void;
} = {};

function BasicDesktopOverlay() {
  const [isShowOverlay, setOverlayStatus] = useState(false);

  const changeOverlayStatus = useCallback((isOpen: boolean) => {
    setOverlayStatus(isOpen);
  }, []);
  useEffect(() => {
    ref.statusChange = changeOverlayStatus;
    return () => {
      ref.statusChange = undefined;
    };
  }, [changeOverlayStatus]);
  return isShowOverlay ? (
    <Stack position="absolute" top={0} bottom={0} left={0} right={0} />
  ) : null;
}

export const dispatchOverlayEvent = (isOpen: boolean) => {
  ref.statusChange?.(isOpen);
};

export const DesktopOverlay = memo(BasicDesktopOverlay);
