import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Icon } from '@onekeyhq/components';

import { HARDWARE_BRIDGE_DOWNLOAD_URL } from '../../config';
import { openUrlExternal } from '../../utils/openUrl';

export type NeedBridgeDialogProps = {
  onClose?: () => void;
};

const NeedBridgeDialog: FC<NeedBridgeDialogProps> = ({ onClose }) => {
  const intl = useIntl();

  return (
    <Dialog
      visible
      onClose={() => {
        onClose?.();
      }}
      contentProps={{
        icon: <Icon name="ExclamationTriangleOutline" size={48} />,
        title: intl.formatMessage({ id: 'modal__need_install_onekey_bridge' }),
        content: intl.formatMessage({
          id: 'modal__need_install_onekey_bridge_desc',
        }),
      }}
      footerButtonProps={{
        primaryActionTranslationId: 'action__download',
        // eslint-disable-next-line @typescript-eslint/no-shadow
        onPrimaryActionPress: ({ onClose }) => {
          openUrlExternal(HARDWARE_BRIDGE_DOWNLOAD_URL);
          onClose?.();
        },
      }}
    />
  );
};
NeedBridgeDialog.displayName = 'NeedBridgeDialog';

export default NeedBridgeDialog;
