import React, { FC, useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Icon, Spinner } from '@onekeyhq/components';
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
        icon: <Icon name="ExclamationOutline" size={48} />,
        title: intl.formatMessage({ id: 'model__create_passphrase_wallet' }),
        content: intl.formatMessage({
          id: 'model__create_passphrase_wallet_dsc',
        }),
      }}
      footerMoreView={<Spinner />}
      footerButtonProps={{
        hidePrimaryAction: true,
        hideSecondaryAction: true,
      }}
    />
  );
};

export default CreateHwWalletDialog;
