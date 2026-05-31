import { useIntl } from 'react-intl';

import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { WebAccountPanelPopover } from './WebAccountPanelPopover';

export function WebSettingsTrigger() {
  const intl = useIntl();
  const trigger = (
    <HeaderIconButton
      size="medium"
      icon="DotHorOutline"
      title={intl.formatMessage({ id: ETranslations.settings_settings })}
      testID="web-settings-trigger"
    />
  );
  return (
    <WebAccountPanelPopover
      renderTrigger={trigger}
      initialView="settings"
      connected={false}
    />
  );
}
