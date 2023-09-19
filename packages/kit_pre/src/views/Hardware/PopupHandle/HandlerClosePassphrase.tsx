import type { FC } from 'react';
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import { showDialog } from '@onekeyhq/kit/src/utils/overlayUtils';

import HardwareLoadingDialog from '../Onekey/OnekeyHardwareConnectDialog';

type HandlerClosePassphraseViewProps = {
  deviceConnectId: string;
  onClose: () => void;
};

const HandlerClosePassphraseView: FC<HandlerClosePassphraseViewProps> = ({
  deviceConnectId,
  onClose,
}) => {
  const intl = useIntl();
  const { serviceHardware } = backgroundApiProxy;

  const showLoadingDialog = useCallback(() => {
    setTimeout(
      () =>
        showDialog(
          <HardwareLoadingDialog
            onHandler={() =>
              serviceHardware
                .applySettings(deviceConnectId, {
                  usePassphrase: false,
                })
                .catch((e) => {
                  deviceUtils.showErrorToast(e);
                })
            }
          />,
        ),
      100,
    );
  }, [deviceConnectId, serviceHardware]);

  return (
    <Dialog
      visible
      onClose={onClose}
      contentProps={{
        title: intl.formatMessage({
          id: 'dialog__device_has_enabled_passphrase',
        }),
        content: intl.formatMessage({
          id: 'dialog__device_has_enabled_passphrase_desc',
        }),
        iconName: 'LockClosedMini',
        iconType: 'success',
      }}
      footerButtonProps={{
        primaryActionTranslationId: 'action__disable',
        onSecondaryActionPress: () => onClose?.(),
        onPrimaryActionPress: () => {
          onClose?.();
          showLoadingDialog();
        },
      }}
    />
  );
};

export default HandlerClosePassphraseView;
