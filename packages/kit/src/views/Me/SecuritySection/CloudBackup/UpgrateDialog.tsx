import { useIntl } from 'react-intl';

import { Dialog, ToastManager } from '@onekeyhq/components';
import appUpdates from '@onekeyhq/kit/src/utils/updates/AppUpdates';

import { showDialog } from '../../../../utils/overlayUtils';

function UpgrateDialog({ onClose }: { onClose?: () => void }) {
  const intl = useIntl();

  return (
    <Dialog
      visible
      onClose={onClose}
      footerButtonProps={{
        primaryActionTranslationId: 'action__upgrade',
        secondaryActionTranslationId: 'action__cancel',
        primaryActionProps: {
          type: 'primary',
          onPromise: async () => {
            try {
              const packageInfo = await appUpdates.getPackageInfo();
              if (packageInfo) {
                appUpdates.openAppUpdate({ package: packageInfo });
                onClose?.();
              }
            } catch (error) {
              ToastManager.show({
                title: intl.formatMessage({
                  id: 'msg__network_request_failed',
                }),
              });
            }
          },
        },
      }}
      contentProps={{
        iconType: 'info',
        title: intl.formatMessage({
          id: 'dialog__import_data_upgrade_required',
        }),
        content: intl.formatMessage({
          id: 'dialog__import_data_upgrade_required_desc',
        }),
      }}
    />
  );
}

export const showUpgrateDialog = () => {
  showDialog(<UpgrateDialog />);
};
