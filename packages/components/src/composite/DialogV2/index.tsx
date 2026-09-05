import { useCallback, useMemo } from 'react';

import { Dialog } from '@base-ui/react/dialog';

import { useThemeName } from '@onekeyhq/components/src/hooks/useStyle';

import './dialog.css';

import type { IDialogV2Props } from './type';
import type { DialogRootChangeEventDetails } from '@base-ui/react/dialog';

export function DialogV2({
  open,
  onOpenChange,
  children,
  dismissible = true,
  background,
}: IDialogV2Props) {
  const themeName = useThemeName();
  const theme = themeName.includes('dark') ? 'dark' : 'light';

  const popupStyle = useMemo(
    () => (background ? { background } : undefined),
    [background],
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean, details: DialogRootChangeEventDetails) => {
      // There is no prop for the escape key — cancelling the change event by
      // reason is the only lever. Backdrop presses are handled separately by
      // disablePointerDismissal.
      if (!nextOpen && !dismissible && details.reason === 'escape-key') {
        details.cancel();
        return;
      }
      onOpenChange(nextOpen);
    },
    [dismissible, onOpenChange],
  );

  return (
    <Dialog.Root
      open={open}
      onOpenChange={handleOpenChange}
      disablePointerDismissal={!dismissible}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="okd-overlay" />
        <Dialog.Popup
          className="okd-content"
          data-theme={theme}
          style={popupStyle}
        >
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
