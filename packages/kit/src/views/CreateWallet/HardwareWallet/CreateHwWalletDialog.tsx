import React, { FC, useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Spinner } from '@onekeyhq/components';
import { OneKeyErrorClassNames } from '@onekeyhq/engine/src/errors';
import { Device } from '@onekeyhq/engine/src/types/device';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { deviceUtils } from '../../../utils/hardware';
import { DeviceNotFind } from '../../../utils/hardware/errors';

export type CreateHwWalletDialogProps = {
  deviceId: string;
  onlyPassphrase?: boolean;
  onClose: () => void;
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
        const { className } = e || {};
        if (className === OneKeyErrorClassNames.OneKeyAlreadyExistWalletError) {
          return;
        }

        deviceUtils.showErrorToast(e);
      })
      .finally(() => {
        onClose();
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
