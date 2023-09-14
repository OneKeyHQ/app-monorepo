import type { FC } from 'react';
import { useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Spinner, ToastManager } from '@onekeyhq/components';
import { ToastManagerType } from '@onekeyhq/components/src/ToastManager';
import type { Device } from '@onekeyhq/engine/src/types/device';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { DeviceNotFind } from '@onekeyhq/shared/src/errors';
import { OneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';

import { deviceUtils } from '../../../utils/hardware';

export type CreateHwWalletDialogProps = {
  deviceId: string;
  onlyPassphrase?: boolean;
  onClose?: () => void;
};

const CreateHwWalletDialog: FC<CreateHwWalletDialogProps> = ({
  deviceId,
  onlyPassphrase,
  onClose,
}) => {
  const intl = useIntl();
  const { serviceAccount, engine } = backgroundApiProxy;

  useEffect(() => {
    engine
      .getHWDevice(deviceId)
      .then((device: Device | null) => {
        if (!device) throw new DeviceNotFind();
        if (!device?.features) throw new DeviceNotFind();

        return serviceAccount.createHWWallet({
          features: JSON.parse(device.features),
          onlyPassphrase,
          connectId: device.mac ?? '',
        });
      })
      .catch((e) => {
        const { className, data } = e || {};
        if (className === OneKeyErrorClassNames.OneKeyAlreadyExistWalletError) {
          const { walletName: existsWalletName } = data || {};
          if (existsWalletName) {
            ToastManager.show(
              {
                title: intl.formatMessage(
                  { id: 'msg__wallet_already_exist_activated_automatically' },
                  { 0: existsWalletName },
                ),
              },
              { type: ToastManagerType.default },
            );
          }
          return;
        }

        deviceUtils.showErrorToast(e);
      })
      .finally(() => {
        onClose?.();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog
      visible
      contentProps={{
        icon: <Spinner size="lg" />,
        title: intl.formatMessage({ id: 'model__create_passphrase_wallet' }),
      }}
      // footerMoreView={<Spinner />}
      footerButtonProps={{
        hidePrimaryAction: true,
        hideSecondaryAction: true,
      }}
    />
  );
};

export default CreateHwWalletDialog;
