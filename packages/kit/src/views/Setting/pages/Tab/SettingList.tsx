import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Page,
  ScrollView,
  SearchBar,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';

import { useSettingsConfig } from './config';
import { SocialButtonGroup } from './CustomElement';
import { TabSettingsListItem } from './ListItem';
import { SearchView } from './SearchView';
import { useSearch } from './useSearch';

export function SettingList() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const settingsConfig = useSettingsConfig();
  const filteredSettingsConfig = useMemo(() => {
    return settingsConfig.filter((config) => config && !config.isHidden);
  }, [settingsConfig]);
  const { onSearch, searchResult, isSearching } = useSearch();
  return (
    <Page>
      <Page.Header
        headerShown
        title={intl.formatMessage({ id: ETranslations.global_settings })}
      />
      <Page.Body>
        <XStack px="$5" pb="$4">
          <SearchBar onSearchTextChange={onSearch} />
        </XStack>
        <YStack flex={1}>
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ pb: '$10' }}
          >
            {isSearching ? (
              <SearchView sections={searchResult} isSearching={isSearching} />
            ) : (
              <>
                {filteredSettingsConfig.map((config) =>
                  config ? (
                    <TabSettingsListItem
                      {...config.tabBarItemStyle}
                      drillIn
                      showDot={config.showDot}
                      key={config.title}
                      icon={config.icon as IKeyOfIcons}
                      iconProps={config.tabBarIconStyle}
                      title={config.title}
                      subtitle={config.subtitle}
                      px="$7"
                      titleProps={config.tabBarLabelStyle}
                      onPress={() => {
                        navigation.push(
                          EModalSettingRoutes.SettingListSubModal,
                          {
                            title: config.title,
                            name: config.name,
                          },
                        );
                      }}
                    />
                  ) : null,
                )}
              </>
            )}
          </ScrollView>
        </YStack>
        <SocialButtonGroup />
      </Page.Body>
    </Page>
  );
}
