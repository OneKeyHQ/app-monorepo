import { useMemo } from 'react';

import { useRoute } from '@react-navigation/core';

import type {
  EModalSettingRoutes,
  IModalSettingParamList,
} from '@onekeyhq/shared/src/routes';

import { useSettingsConfig } from './config';
import { SubSettingsPage } from './SubSettingsPage';

import type { RouteProp } from '@react-navigation/core';

type ISettingName = string;

export default function SettingListSubModal() {
  const route =
    useRoute<
      RouteProp<IModalSettingParamList, EModalSettingRoutes.SettingListSubModal>
    >();
  const { name, title } = route.params || {};
  const settingsConfig = useSettingsConfig();
  const filteredSettingsConfig = useMemo(() => {
    return settingsConfig.filter((config) => config && !config.isHidden);
  }, [settingsConfig]);
  return (
    <SubSettingsPage
      name={name as ISettingName}
      title={title || ''}
      settingsConfig={filteredSettingsConfig}
    />
  );
}
