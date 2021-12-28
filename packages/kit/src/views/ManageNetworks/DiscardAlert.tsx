import React, { FC } from 'react';

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
}) => (
  <Dialog
    visible={visible}
    contentProps={{
      iconType: 'info',
      title: 'Discard Changes',
      content: 'Are you sure to discard the unsaved changes',
    }}
    footerButtonProps={{
      onPrimaryActionPress: ({ onClose: handleClose }) => {
        handleClose?.();
        setTimeout(() => {
          onConfirm?.();
        }, 100);
      },
      primaryActionProps: {
        type: 'primary',
        size: 'xl',
      },
      secondaryActionProps: {
        size: 'xl',
      },
    }}
    onClose={onClose}
  />
);
