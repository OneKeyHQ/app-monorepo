import { FC } from 'react';

import { Dialog, IconShape } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { HardwareUpdateModalRoutes } from '@onekeyhq/kit/src/routes/Modal/HardwareUpdate';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/routesEnum';

type HandlerFirmwareUpgradeViewProps = {
  deviceId: string;
  content: string;
  onClose: () => void;
};

const HandlerFirmwareUpgradeView: FC<HandlerFirmwareUpgradeViewProps> = ({
  deviceId,
  content,
  onClose,
}) => {
  const navigation = useAppNavigation();
  return (
    <Dialog
      visible
      onClose={onClose}
      contentProps={{
        title: content,
        icon: (
          <IconShape
            name="UploadOutline"
            color="icon-warning"
            bgColor="surface-warning-default"
          />
        ),
      }}
      footerButtonProps={{
        primaryActionTranslationId: 'action__update_now',
        onSecondaryActionPress: () => onClose?.(),
        onPrimaryActionPress: () => {
          onClose?.();

          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.HardwareUpdate,
            params: {
              screen: HardwareUpdateModalRoutes.HardwareUpdateInfoModel,
              params: {
                deviceId,
                recheckFirmwareUpdate: true,
              },
            },
          });
        },
      }}
    />
  );
};

export default HandlerFirmwareUpgradeView;
