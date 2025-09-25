import { Dialog, Switch, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePerpsCustomSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import { PerpsProviderMirror } from '../PerpsProviderMirror';

interface IPerpSettingsDialogContentProps {
  close: () => void;
}

function PerpSettingsDialogContent(_: IPerpSettingsDialogContentProps) {
  const [perpsCustomSettings, setPerpsCustomSettings] =
    usePerpsCustomSettingsAtom();

  return (
    <YStack gap="$5">
      <ListItem
        mx="$0"
        p="$0"
        title="Skip Order Confirmation"
        subtitle="Submits orders directly without confirmation when enabled"
      >
        <Switch
          value={perpsCustomSettings.skipOrderConfirm}
          onChange={(value) => {
            setPerpsCustomSettings((prev) => ({
              ...prev,
              skipOrderConfirm: value,
            }));
          }}
        />
      </ListItem>
    </YStack>
  );
}

export function showPerpSettingsDialog() {
  const dialog = Dialog.show({
    title: appLocale.intl.formatMessage({ id: ETranslations.global_settings }),
    renderContent: (
      <PerpsProviderMirror>
        <PerpSettingsDialogContent
          close={() => {
            void dialog.close();
          }}
        />
      </PerpsProviderMirror>
    ),
    showFooter: true,
    showCancelButton: false,
    onConfirmText: 'Confirm',
  });

  return dialog;
}
