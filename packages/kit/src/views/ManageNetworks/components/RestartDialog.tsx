import type { FC } from 'react';
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type Props = {
  onClose?: () => void;
  onConfirm?: () => void;
};

const RestartAppDialog: FC<Props> = ({ onClose, onConfirm }) => {
  const intl = useIntl();

  const restart = useCallback(() => {
    onClose?.();
    onConfirm?.();
  }, [onClose, onConfirm]);

  return (
    <Dialog
      visible
      contentProps={{
        title: intl.formatMessage({ id: 'dialog__restart_required' }),
        content: intl.formatMessage({
          id: 'dialog__restart_required_desc',
        }),
      }}
      footerButtonProps={{
        primaryActionTranslationId: platformEnv.isMas
          ? 'action__close'
          : 'action__restart',
        primaryActionProps: {
          type: 'primary',
        },
        onPrimaryActionPress: restart,
        onSecondaryActionPress: onClose,
      }}
    />
  );
};

export default RestartAppDialog;
