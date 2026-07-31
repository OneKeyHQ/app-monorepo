import { useCallback } from 'react';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { Icon, SizableText } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useUniversalSearchActions } from '@onekeyhq/kit/src/states/jotai/contexts/universalSearch';
import { useIsTabNavigator } from '@onekeyhq/kit/src/views/Setting/pages/Tab/useIsTabNavigator';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IModalSettingParamList } from '@onekeyhq/shared/src/routes';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes/setting';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IUniversalSearchSettings } from '@onekeyhq/shared/types/search';

interface IUniversalSearchSettingsItemProps {
  item: IUniversalSearchSettings;
  getSearchInput: () => string;
}

export function UniversalSearchSettingsItem({
  item,
  getSearchInput,
}: IUniversalSearchSettingsItemProps) {
  const navigation = useAppNavigation();
  const universalSearchActions = useUniversalSearchActions();
  const {
    title,
    icon,
    sectionName,
    sectionTitle,
    settingRoute,
    settingsTab,
    onPress,
  } = item.payload;
  const isTabNavigator = useIsTabNavigator();
  const handlePress = useCallback(async () => {
    defaultLogger.universalSearch.search.universalSearchClick({
      searchText: getSearchInput(),
      type: item.type,
      itemId: settingRoute ?? sectionName ?? title,
      itemTitle: title,
    });

    navigation.pop();
    await timerUtils.wait(300);

    if (settingsTab && isTabNavigator) {
      // On tab-navigator layouts the target lives as a settings sidebar tab;
      // open the settings modal focused on that tab instead of stacking the
      // standalone page.
      navigation.pushModal(EModalRoutes.SettingModal, {
        screen: EModalSettingRoutes.SettingListModal,
        params: { screen: settingsTab },
      });
    } else if (settingRoute) {
      navigation.pushModal(EModalRoutes.SettingModal, {
        screen: settingRoute as keyof IModalSettingParamList,
      });
    } else if (onPress) {
      onPress(navigation);
    } else if (sectionName) {
      navigation.pushModal(EModalRoutes.SettingModal, {
        screen: EModalSettingRoutes.SettingListSubModal,
        params: { name: sectionName, title: sectionTitle },
      });
    } else {
      navigation.pushModal(EModalRoutes.SettingModal, {
        screen: EModalSettingRoutes.SettingListModal,
      });
    }

    await timerUtils.wait(10);
    universalSearchActions.current.addIntoRecentSearchList({
      id: `settings-${settingRoute ?? title}`,
      text: title,
      type: item.type,
      timestamp: Date.now(),
      extra: {
        sectionTitle,
        settingRoute: settingRoute ?? '',
      },
    });
  }, [
    navigation,
    settingRoute,
    onPress,
    sectionName,
    sectionTitle,
    settingsTab,
    isTabNavigator,
    universalSearchActions,
    title,
    item.type,
    getSearchInput,
  ]);

  return (
    <ListItem onPress={handlePress}>
      <Icon name={icon as IKeyOfIcons} size="$6" color="$iconSubdued" />
      <ListItem.Text
        flex={1}
        primary={title}
        secondary={
          <SizableText size="$bodyMd" color="$textSubdued">
            {sectionTitle}
          </SizableText>
        }
      />
    </ListItem>
  );
}
