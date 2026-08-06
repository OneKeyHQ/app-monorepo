import { useCallback, useMemo } from 'react';

import { Dialog } from '@base-ui/react/dialog';

import { useThemeName } from '@onekeyhq/components/src/hooks/useStyle';

import './dialog.css';

import type { IDialogV2Props } from './type';
import type { DialogRootChangeEventDetails } from '@base-ui/react/dialog';

const X_ICON = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const PRIMARY_CLASS = 'okd-button okd-button-primary';
const DESTRUCTIVE_CLASS = 'okd-button okd-button-destructive';

export function DialogV2({
  open,
  onOpenChange,
  title,
  description,
  children,
  tone = 'default',
  confirmText,
  onConfirm,
  cancelText,
  onCancel,
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

  const hasHeader = Boolean(title) || Boolean(description);
  const hasFooter = Boolean(confirmText) || Boolean(cancelText);

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
          {hasHeader ? (
            <div className="okd-header">
              {title ? (
                <Dialog.Title className="okd-title">{title}</Dialog.Title>
              ) : null}
              {description ? (
                <Dialog.Description className="okd-description">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
          ) : null}
          {children}
          {hasFooter ? (
            <div className="okd-footer">
              {cancelText ? (
                <Dialog.Close
                  className="okd-button okd-button-secondary"
                  onClick={onCancel}
                >
                  {cancelText}
                </Dialog.Close>
              ) : null}
              {confirmText ? (
                <Dialog.Close
                  className={
                    tone === 'destructive' ? DESTRUCTIVE_CLASS : PRIMARY_CLASS
                  }
                  onClick={onConfirm}
                >
                  {confirmText}
                </Dialog.Close>
              ) : null}
            </div>
          ) : null}
          {dismissible ? (
            <Dialog.Close className="okd-close" aria-label="Close">
              {X_ICON}
            </Dialog.Close>
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
