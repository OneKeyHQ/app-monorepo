import { FC } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import { showOverlay } from '@onekeyhq/kit/src/utils/overlayUtils';

import HardwareLoadingDialog from '../Onekey/OnekeyHardwareConnectDialog';

type HandlerOpenPassphraseViewProps = {
  deviceConnectId: string;
  onClose: () => void;
};

const HandlerOpenPassphraseView: FC<HandlerOpenPassphraseViewProps> = ({
  deviceConnectId,
  onClose,
}) => {
  const intl = useIntl();
  const { serviceHardware } = backgroundApiProxy;

  return (
    <Dialog
      visible
      onClose={onClose}
      contentProps={{
        title: intl.formatMessage({
          id: 'dialog__device_has_disabled_passphrase',
        }),
        content: intl.formatMessage({
          id: 'dialog__device_has_disabled_passphrase_desc',
        }),
        iconName: 'LockClosedOutline',
        iconType: 'success',
      }}
      footerButtonProps={{
        primaryActionTranslationId: 'action__enable',
        onSecondaryActionPress: () => onClose?.(),
        onPrimaryActionPress: () => {
          onClose?.();

          showOverlay((onCloseOverlay) => (
            <HardwareLoadingDialog
              onClose={onCloseOverlay}
              onHandler={() =>
                serviceHardware
                  .applySettings(deviceConnectId, {
                    usePassphrase: true,
                  })
                  .catch((e) => {
                    deviceUtils.showErrorToast(e);
                  })
              }
            />
          ));
        },
      }}
    />
  );
};

export default HandlerOpenPassphraseView;
