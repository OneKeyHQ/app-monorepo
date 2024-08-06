import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';

export const CustomNetworkConfigItem = () => {
  const intl = useIntl();
  const appNavigation = useAppNavigation();
  const onPress = useCallback(() => {
    appNavigation.navigate(
      EModalSettingRoutes.SettingExportCustomNetworkConfig,
    );
  }, [appNavigation]);
  return (
    <ListItem
      onPress={onPress}
      icon="FileDownloadOutline"
      title={intl.formatMessage({
        id: ETranslations.settings_export_network_config_label,
      })}
      drillIn
    />
  );
};
