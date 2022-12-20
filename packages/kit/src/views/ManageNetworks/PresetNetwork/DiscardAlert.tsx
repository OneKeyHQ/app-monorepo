import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';

type DiscardAlertProps = {
  visible?: boolean;
  onConfirm?: () => void;
  onClose?: () => void;
};

export const DiscardAlert: FC<DiscardAlertProps> = ({
  visible,
  onClose,
  onConfirm,
}) => {
  const intl = useIntl();
  return (
    <Dialog
      visible={visible}
      contentProps={{
        iconType: 'info',
        title: intl.formatMessage({
          id: 'dialog__discard_changes_title',
          defaultMessage: 'Discard Changes',
        }),
        content: intl.formatMessage({
          id: 'dialog__discard_changes_desc',
          defaultMessage: 'Are you sure to discard the unsaved changes',
        }),
      }}
      footerButtonProps={{
        onPrimaryActionPress: ({ onClose: handleClose }) => {
          handleClose?.();
          setTimeout(() => {
            onConfirm?.();
          }, 500);
        },
        primaryActionTranslationId: 'action__discard',
        secondaryActionTranslationId: 'action__cancel',
        primaryActionProps: {
          type: 'primary',
        },
        secondaryActionProps: {},
      }}
      onClose={onClose}
    />
  );
};
