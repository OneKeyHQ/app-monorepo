import type { FC } from 'react';
import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { CheckBox, Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import { showDialog } from '@onekeyhq/kit/src/utils/overlayUtils';

import HardwareLoadingDialog from './OnekeyHardwareConnectDialog';

type EnablePassphraseDialogProps = {
  deviceConnectId: string;
  onClose: () => void;
  onSuccess: () => void;
  onError: (error: Error) => void;
};

const EnablePassphraseDialog: FC<EnablePassphraseDialogProps> = ({
  deviceConnectId,
  onClose,
  onSuccess,
  onError,
}) => {
  const intl = useIntl();
  const { serviceHardware } = backgroundApiProxy;
  const [confirmed, setConfirmed] = useState(false);

  const showLoadingDialog = useCallback(() => {
    setTimeout(
      () =>
        showDialog(
          <HardwareLoadingDialog
            onHandler={() =>
              serviceHardware
                .applySettings(deviceConnectId, {
                  usePassphrase: true,
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
          />,
        ),
      100,
    );
  }, [deviceConnectId, onError, onSuccess, serviceHardware]);

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
        iconType: 'warning',
        input: (
          <CheckBox
            w="full"
            mt="4"
            isChecked={confirmed}
            defaultIsChecked={false}
            onChange={(checked) => {
              setConfirmed(checked);
            }}
            title={intl.formatMessage({
              id: 'dialog__device_has_desabled_passphrase_double_check',
            })}
          />
        ),
      }}
      footerButtonProps={{
        primaryActionTranslationId: 'action__enable',
        onSecondaryActionPress: () => onClose?.(),
        primaryActionProps: {
          disabled: !confirmed,
          isDisabled: !confirmed,
        },
        onPrimaryActionPress: () => {
          showLoadingDialog();
        },
      }}
    />
  );
};

export default EnablePassphraseDialog;
