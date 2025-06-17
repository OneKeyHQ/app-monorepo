import { useMemo } from 'react';

import { useRoute } from '@react-navigation/core';

import type {
  EModalSettingRoutes,
  IModalSettingParamList,
} from '@onekeyhq/shared/src/routes';

import { HideOnSideBarTabNames, useSettingsConfig } from './config';
import { SubSettingsPage } from './SubSettingsPage';

import type { RouteProp } from '@react-navigation/core';

type ISettingName = string;

export default function SettingListSubModal() {
  const route =
    useRoute<
      RouteProp<IModalSettingParamList, EModalSettingRoutes.SettingListSubModal>
    >();
  const { name } = route.params || {};
  const settingsConfig = useSettingsConfig();
  const filteredSettingsConfig = useMemo(() => {
    return settingsConfig.filter(
      (config) => config && !HideOnSideBarTabNames.includes(config?.name),
    );
  }, [settingsConfig]);
  return (
    <SubSettingsPage
      name={name as ISettingName}
      settingsConfig={filteredSettingsConfig}
    />
  );
}
