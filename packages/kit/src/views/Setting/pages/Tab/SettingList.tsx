import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Divider,
  Page,
  ScrollView,
  SearchBar,
  XStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';

import { useOnLock } from '../List/DefaultSection';

import { useSettingsConfig } from './config';
import { SocialButtonGroup } from './CustomElement';
import { TabSettingsListItem } from './ListItem';
import { SearchView } from './SearchView';
import { useSearch } from './useSearch';

export function SettingList() {
  const intl = useIntl();
  const onLock = useOnLock();
  const handleLock = useCallback(async () => {
    await onLock();
  }, [onLock]);
  const navigation = useAppNavigation();
  const settingsConfig = useSettingsConfig();
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
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ pb: '$5' }}
        >
          {isSearching ? (
            <SearchView sections={searchResult} isSearching={isSearching} />
          ) : (
            <>
              <TabSettingsListItem
                drillIn
                title={intl.formatMessage({
                  id: ETranslations.settings_lock_now,
                })}
                icon="LockOutline"
                onPress={async () => {
                  await handleLock();
                }}
              />
              <Divider />
              {settingsConfig.map((config) =>
                config ? (
                  <TabSettingsListItem
                    drillIn
                    key={config.title}
                    icon={config.icon as IKeyOfIcons}
                    title={config.title}
                    onPress={() => {
                      navigation.push(EModalSettingRoutes.SettingListSubModal, {
                        name: config.title,
                      });
                    }}
                  />
                ) : null,
              )}
              <SocialButtonGroup />
            </>
          )}
        </ScrollView>
      </Page.Body>
    </Page>
  );
}
