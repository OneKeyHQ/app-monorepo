import { useIntl } from 'react-intl';

import { Dialog, Icon } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { ModalRoutes, RootRoutes } from '../../routes/routesEnum';

import { ScanQrcodeRoutes } from './types';

export const PermitDeniedDialog = () => {
  const intl = useIntl();
  return (
    <Dialog
      visible
      contentProps={{
        icon: <Icon name="ExclamationTriangleOutline" size={48} />,
        title: intl.formatMessage({ id: 'title__camera_permission_required' }),
        content: intl.formatMessage({
          id: 'msg__approving_camera_permission_needs_to_be_turned_on_in_expand_view',
        }),
      }}
      footerButtonProps={{
        primaryActionProps: {
          children: intl.formatMessage({ id: 'action__open_expand_view' }),
        },
        // eslint-disable-next-line @typescript-eslint/no-shadow
        onPrimaryActionPress: ({ onClose }) => {
          backgroundApiProxy.serviceApp.openExtensionExpandTab({
            routes: [RootRoutes.Modal, ModalRoutes.ScanQrcode],
            params: {
              screen: ScanQrcodeRoutes.RequestPermission,
            },
          });
          onClose?.();
        },
      }}
    />
  );
};
