import { Dialog, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { SectionPressItem } from './SectionPressItem';

export function ResetInstanceId() {
  const [settings] = useSettingsPersistAtom();

  return (
    <SectionPressItem
      icon="RefreshCwOutline"
      title="Reset Instance Id"
      subtitle={settings.instanceId}
      onPress={() => {
        Dialog.confirm({
          title: 'Reset Instance Id',
          description:
            'This will generate a new Instance Id and restart the app. Are you sure?',
          confirmButtonProps: { variant: 'destructive' },
          onConfirm: async () => {
            try {
              await backgroundApiProxy.serviceSetting.resetInstanceId();
              Toast.success({
                title: 'Instance Id reset successfully',
              });
              setTimeout(() => {
                void backgroundApiProxy.serviceApp.restartApp();
              }, 300);
            } catch (error) {
              Toast.error({
                title: 'Failed to reset Instance Id',
                message: String(error),
              });
            }
          },
        });
      }}
    />
  );
}
