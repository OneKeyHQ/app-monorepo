import { useIntl } from 'react-intl';

import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export interface IWebSettingsTriggerProps {
  onPress?: () => void;
}

export function WebSettingsTrigger({ onPress }: IWebSettingsTriggerProps) {
  const intl = useIntl();
  return (
    <HeaderIconButton
      size="medium"
      icon="DotHorOutline"
      title={intl.formatMessage({ id: ETranslations.settings_settings })}
      onPress={onPress}
      testID="web-settings-trigger"
    />
  );
}
