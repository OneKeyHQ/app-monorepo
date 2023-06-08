import type { FC } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Center } from '@onekeyhq/components';
import Dialog from '@onekeyhq/components/src/Dialog';
import Icon from '@onekeyhq/components/src/Icon';
import { HARDWARE_BRIDGE_DOWNLOAD_URL } from '@onekeyhq/shared/src/config/appConfig';

import { openUrlExternal } from '../../utils/openUrl';

import type { MessageDescriptor } from 'react-intl';

export type NeedBridgeDialogProps = {
  onClose?: () => void;
  update?: boolean;
  version?: string;
};

const NeedBridgeDialog: FC<NeedBridgeDialogProps> = ({
  onClose,
  update,
  version,
}) => {
  const intl = useIntl();

  const icon = useMemo(
    () =>
      update ? (
        <Center p={3} rounded="full" bgColor="surface-warning-default">
          <Icon name="UploadOutline" color="icon-warning" size={24} />
        </Center>
      ) : (
        <Icon name="ExclamationTriangleOutline" size={48} />
      ),
    [update],
  );
  const title = useMemo<MessageDescriptor['id']>(
    () =>
      update
        ? 'title__requires_updating_of_onekey_bridge'
        : 'modal__need_install_onekey_bridge',
    [update],
  );
  const content = useMemo<MessageDescriptor['id']>(
    () =>
      update
        ? 'content__onekey_bridge_str_is_now_available_do_you_want_to_download'
        : 'modal__need_install_onekey_bridge_desc',
    [update],
  );

  return (
    <Dialog
      visible
      onClose={onClose}
      contentProps={{
        icon,
        title: intl.formatMessage({ id: title }),
        content: intl.formatMessage(
          {
            id: content,
          },
          update ? { 0: version ?? '' } : undefined,
        ),
      }}
      footerButtonProps={{
        primaryActionTranslationId: 'action__download',
        // eslint-disable-next-line @typescript-eslint/no-shadow
        onPrimaryActionPress: ({ onClose }) => {
          openUrlExternal(HARDWARE_BRIDGE_DOWNLOAD_URL);
          onClose?.();
        },
      }}
    />
  );
};
NeedBridgeDialog.displayName = 'NeedBridgeDialog';

export default NeedBridgeDialog;
