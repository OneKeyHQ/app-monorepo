import { FC } from 'react';

import DialogCommon from '@onekeyhq/components/src/Dialog/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { HardwareUpdateModalRoutes } from '@onekeyhq/kit/src/routes/Modal/HardwareUpdate';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/routesEnum';

import BaseRequestView, { BaseRequestViewProps } from './BaseRequest';

type HandlerFirmwareUpgradeViewProps = {
  deviceId: string;
  deviceConnectId: string;
  content: string;
} & Omit<BaseRequestViewProps, 'children'>;

const HandlerFirmwareUpgradeView: FC<HandlerFirmwareUpgradeViewProps> = ({
  deviceId,
  deviceConnectId,
  content,
  onClose,
  ...props
}) => {
  const navigation = useAppNavigation();
  return (
    <BaseRequestView {...props}>
      <DialogCommon.Content iconType="info" title={content} />

      <DialogCommon.FooterButton
        onSecondaryActionPress={() => onClose?.()}
        onPrimaryActionPress={() => {
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
        }}
      />
    </BaseRequestView>
  );
};

export default HandlerFirmwareUpgradeView;
