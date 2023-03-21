import { useIntl } from 'react-intl';

import { Dialog, ToastManager } from '@onekeyhq/components';
import appUpdates from '@onekeyhq/kit/src/utils/updates/AppUpdates';

import { showOverlay } from '../../../../utils/overlayUtils';

function UpgrateDialog({ closeOverlay }: { closeOverlay: () => void }) {
  const intl = useIntl();

  return (
    <Dialog
      visible
      onClose={closeOverlay}
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
                closeOverlay();
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

const showUpgrateDialog = () => {
  showOverlay((close) => <UpgrateDialog closeOverlay={close} />);
};

export { showUpgrateDialog };
