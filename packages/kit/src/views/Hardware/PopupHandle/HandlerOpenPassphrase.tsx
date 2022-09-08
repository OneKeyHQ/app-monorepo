import { FC } from 'react';

import DialogCommon from '@onekeyhq/components/src/Dialog/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import { showOverlay } from '@onekeyhq/kit/src/utils/overlayUtils';

import HardwareLoadingDialog from '../Onekey/OnekeyHardwareConnectDialog';

import BaseRequestView, { BaseRequestViewProps } from './BaseRequest';

type HandlerOpenPassphraseViewProps = {
  deviceId: string;
  deviceConnectId: string;
  content: string;
} & Omit<BaseRequestViewProps, 'children'>;

const HandlerOpenPassphraseView: FC<HandlerOpenPassphraseViewProps> = ({
  deviceId,
  deviceConnectId,
  content,
  onClose,
  ...props
}) => {
  const { serviceHardware } = backgroundApiProxy;

  return (
    <BaseRequestView {...props} closeWay="now">
      <DialogCommon.Content iconType="info" title={content} />

      <DialogCommon.FooterButton
        onSecondaryActionPress={() => onClose?.()}
        onPrimaryActionPress={() => {
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
        }}
      />
    </BaseRequestView>
  );
};

export default HandlerOpenPassphraseView;
