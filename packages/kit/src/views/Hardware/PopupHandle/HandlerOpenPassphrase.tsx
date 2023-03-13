import type { FC } from 'react';

import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';

import EnablePassphraseDialog from '../Onekey/EnablePassphraseDialog';

type HandlerOpenPassphraseViewProps = {
  deviceConnectId: string;
  onClose: () => void;
};

const HandlerOpenPassphraseView: FC<HandlerOpenPassphraseViewProps> = ({
  deviceConnectId,
  onClose,
}) => (
  <EnablePassphraseDialog
    deviceConnectId={deviceConnectId}
    onClose={onClose}
    onSuccess={onClose}
    onError={(e) => {
      deviceUtils.showErrorToast(e);
      onClose?.();
    }}
  />
);

export default HandlerOpenPassphraseView;
