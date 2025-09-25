import { Dialog, Switch, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePerpsCustomSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import { PerpsProviderMirror } from '../PerpsProviderMirror';
import { useIntl } from 'react-intl';

interface IPerpSettingsDialogContentProps {
  close: () => void;
}

function PerpSettingsDialogContent(_: IPerpSettingsDialogContentProps) {
  const [perpsCustomSettings, setPerpsCustomSettings] =
    usePerpsCustomSettingsAtom();
  const intl = useIntl();
  return (
    <YStack gap="$5">
      <ListItem
        mx="$0"
        p="$0"
        title={intl.formatMessage({
          id: ETranslations.perp_setting_title,
        })}
        subtitle={intl.formatMessage({
          id: ETranslations.perp_setting_desc,
        })}
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
    onConfirmText: appLocale.intl.formatMessage({
      id: ETranslations.global_confirm,
    }),
  });

  return dialog;
}
