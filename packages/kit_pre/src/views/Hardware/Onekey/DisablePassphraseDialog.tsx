import type { FC } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';

import HardwareLoadingDialog from './OnekeyHardwareConnectDialog';

type DisablePassphraseDialogProps = {
  deviceConnectId: string;
  onClose: () => void;
  onSuccess: () => void;
  onError: (error: Error) => void;
};

const DisablePassphraseDialog: FC<DisablePassphraseDialogProps> = ({
  deviceConnectId,
  onClose,
  onSuccess,
  onError,
}) => {
  const { serviceHardware } = backgroundApiProxy;

  return (
    <HardwareLoadingDialog
      onClose={onClose}
      onHandler={() =>
        serviceHardware
          .applySettings(deviceConnectId, {
            usePassphrase: false,
          })
          .then(() => {
            onSuccess?.();
          })
          .catch((e) => {
            onError?.(e);
            setTimeout(() => {
              deviceUtils.showErrorToast(e);
            }, 500);
          })
      }
    />
  );
};

export default DisablePassphraseDialog;
