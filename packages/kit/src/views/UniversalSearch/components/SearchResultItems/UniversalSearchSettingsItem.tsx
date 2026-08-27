import { useCallback } from 'react';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { Icon, SizableText } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useUniversalSearchActions } from '@onekeyhq/kit/src/states/jotai/contexts/universalSearch';
import { tryNavigateToSettingsTabInModal } from '@onekeyhq/kit/src/views/Setting/pages/Tab/navigateToSettingsTab';
import { useIsTabNavigator } from '@onekeyhq/kit/src/views/Setting/pages/Tab/useIsTabNavigator';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  ESettingsTabNames,
  IModalSettingParamList,
} from '@onekeyhq/shared/src/routes';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes/setting';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  EUniversalSearchSource,
  IUniversalSearchSettings,
} from '@onekeyhq/shared/types/search';

interface IUniversalSearchSettingsItemProps {
  item: IUniversalSearchSettings;
  getSearchInput: () => string;
  source: EUniversalSearchSource;
}

export function UniversalSearchSettingsItem({
  item,
  getSearchInput,
  source,
}: IUniversalSearchSettingsItemProps) {
  const navigation = useAppNavigation();
  const universalSearchActions = useUniversalSearchActions();
  const {
    id,
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
      source,
      searchText: getSearchInput(),
      type: item.type,
      // Prefer stable identities (route, then explicit id) over localized
      // fallbacks so analytics series survive copy changes.
      itemId: settingRoute ?? id ?? sectionName ?? title,
      itemTitle: title,
    });

    navigation.pop();
    await timerUtils.wait(300);

    const openSettingsTab = (tabName: ESettingsTabNames) => {
      if (!tryNavigateToSettingsTabInModal(tabName)) {
        navigation.pushModal(EModalRoutes.SettingModal, {
          screen: EModalSettingRoutes.SettingListModal,
          params: { screen: tabName },
        });
      }
    };

    if (settingsTab && isTabNavigator) {
      // pushModal deduplicates an already-open SettingListModal before it sees
      // the deeper tab parameter, so switch the mounted navigator directly.
      openSettingsTab(settingsTab);
    } else if (settingRoute) {
      navigation.pushModal(EModalRoutes.SettingModal, {
        screen: settingRoute as keyof IModalSettingParamList,
      });
    } else if (onPress) {
      onPress(navigation);
    } else if (sectionName && isTabNavigator) {
      // Custom controls such as Theme and Clear Cache have no leaf route.
      // Keep tab layouts in their sidebar shell instead of opening a
      // standalone category page.
      openSettingsTab(sectionName);
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
      id: `settings-${settingRoute ?? id ?? title}`,
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
    id,
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
    source,
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
