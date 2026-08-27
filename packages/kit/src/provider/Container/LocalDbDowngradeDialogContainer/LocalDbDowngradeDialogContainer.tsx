import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { DialogContainer, Portal } from '@onekeyhq/components';
import { useLocalDbOpenErrorAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/localDb';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { isLocalDbDowngradeErrorMessage } from '../../../components/Password/container/localDbOpenErrorMessage';

type ILocalDbDowngradeDialogState = {
  errorMessage: string | undefined;
  isLocked: boolean;
};

export function createLocalDbDowngradeDialogAcknowledgement() {
  let hasAcknowledged = false;

  return {
    acknowledge: () => {
      hasAcknowledged = true;
    },
    shouldShow: ({ errorMessage, isLocked }: ILocalDbDowngradeDialogState) =>
      !hasAcknowledged &&
      !isLocked &&
      Boolean(errorMessage && isLocalDbDowngradeErrorMessage(errorMessage)),
  };
}

// Keep acknowledgement at module scope so router/split-view remounts restore an
// unacknowledged warning but never show it again after the user confirms it.
const localDbDowngradeDialogAcknowledgement =
  createLocalDbDowngradeDialogAcknowledgement();

export function LocalDbDowngradeDialogContainer() {
  const intl = useIntl();
  const [isLocked] = useAppIsLockedAtom();
  const [{ errorMessage }] = useLocalDbOpenErrorAtom();
  const [, setHasAcknowledged] = useState(false);

  const handleConfirm = useCallback(() => {
    localDbDowngradeDialogAcknowledgement.acknowledge();
    setHasAcknowledged(true);
  }, []);
  const handleClose = useCallback(() => Promise.resolve(), []);

  if (
    !localDbDowngradeDialogAcknowledgement.shouldShow({
      errorMessage,
      isLocked,
    })
  ) {
    return null;
  }

  return (
    <Portal.Body container={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL}>
      <DialogContainer
        open
        testID="local-db-downgrade-dialog"
        icon="ErrorOutline"
        tone="destructive"
        title={intl.formatMessage({
          id: ETranslations.database_read_error_update_app__msg,
        })}
        description={errorMessage}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_got_it,
        })}
        confirmButtonProps={{
          testID: 'local-db-downgrade-dialog-confirm-btn',
        }}
        showFooter
        showConfirmButton
        showExitButton={false}
        showCancelButton={false}
        dismissOnOverlayPress={false}
        disableDrag
        disableSystemClose
        onConfirm={handleConfirm}
        onClose={handleClose}
      />
    </Portal.Body>
  );
}
