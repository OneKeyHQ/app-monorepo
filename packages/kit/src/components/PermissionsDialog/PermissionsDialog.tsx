import { Button, Dialog, SizableText, Stack } from '@onekeyhq/components';
import { ENotificationPermission } from '@onekeyhq/shared/types/notification';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

export const showNotificationPermissionsDialog = () =>
  Dialog.show({
    // title: appLocale.intl.formatMessage({ id: ETranslations.global_rename }),
    title: '通知权限',
    renderContent: (
      <Stack>
        <SizableText>手动开启权限的步骤引导： 1、2、3</SizableText>
        <SizableText>更多详情，请查看帮助中心 →</SizableText>
        <Button
          onPress={() => {
            void backgroundApiProxy.serviceNotification.openPermissionSettings();
          }}
        >
          前往权限设置页 → （部分端可能无法跳转，或跳转错误）
        </Button>
        <Button
          onPress={() => {
            void backgroundApiProxy.serviceNotification.showNotification({
              title: 'test message',
              description: 'This is a test message',
            });
          }}
        >
          消息测试
        </Button>
      </Stack>
    ),
    onConfirmText: '开启权限',
    onConfirm: async ({ close, preventClose }) => {
      preventClose();
      const result =
        await backgroundApiProxy.serviceNotification.enableNotificationPermissions();
      if (result.permission === ENotificationPermission.granted) {
        await close();
      }
    },
  });
