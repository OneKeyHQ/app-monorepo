import type { FC } from 'react';

import { Dialog } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  HardwareUpdateModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';

type HandlerFirmwareUpgradeViewProps = {
  connectId: string;
  content: string;
  onClose: () => void;
};

const HandlerFirmwareUpgradeView: FC<HandlerFirmwareUpgradeViewProps> = ({
  connectId,
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
        iconName: 'UploadOutline',
        iconType: 'warning',
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
                connectId,
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
