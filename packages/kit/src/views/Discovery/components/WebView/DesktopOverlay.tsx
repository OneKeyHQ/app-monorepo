import { memo, useCallback, useEffect, useState } from 'react';

import { Stack } from '@onekeyhq/components';

const BASIC_DESKTOP_OVERLAY_EVENT_NAME = 'root_overlay';

function BasicDesktopOverlay() {
  const [isShowOverlay, setOverlayStatus] = useState(false);

  const changeOverlayStatus = useCallback(
    (event: CustomEvent<{ isOpen: boolean }>) => {
      setOverlayStatus(event.detail.isOpen);
    },
    [],
  ) as EventListener;

  useEffect(() => {
    document.addEventListener(
      BASIC_DESKTOP_OVERLAY_EVENT_NAME,
      changeOverlayStatus,
    );
    return () => {
      document.removeEventListener(
        BASIC_DESKTOP_OVERLAY_EVENT_NAME,
        changeOverlayStatus,
      );
    };
  }, [changeOverlayStatus]);
  return isShowOverlay ? (
    <Stack position="absolute" top={0} bottom={0} left={0} right={0} />
  ) : null;
}

export const dispatchOverlayEvent = (isOpen: boolean) => {
  document.dispatchEvent(
    new CustomEvent<{ isOpen: boolean }>(BASIC_DESKTOP_OVERLAY_EVENT_NAME, {
      detail: { isOpen },
    }),
  );
};

export const DesktopOverlay = memo(BasicDesktopOverlay);
