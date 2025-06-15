import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { Divider, Page, ScrollView, SearchBar } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';

import { useOnLock } from '../List/DefaultSection';

import { useSettingsConfig } from './config';
import { TabSettingsListItem } from './ListItem';

export function SettingList() {
  const intl = useIntl();
  const onLock = useOnLock();
  const handleLock = useCallback(async () => {
    await onLock();
  }, [onLock]);
  const navigation = useAppNavigation();
  const settingsConfig = useSettingsConfig();
  return (
    <Page>
      <Page.Header
        headerShown
        title={intl.formatMessage({ id: ETranslations.global_settings })}
      />
      <Page.Body>
        <SearchBar />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ pb: '$5' }}
        >
          <TabSettingsListItem
            drillIn
            title={intl.formatMessage({ id: ETranslations.settings_lock_now })}
            icon="LockOutline"
            onPress={async () => {
              await handleLock();
            }}
          />
          <Divider />
          {settingsConfig.map(({ icon, translationId }) => (
            <TabSettingsListItem
              drillIn
              key={translationId}
              icon={icon as IKeyOfIcons}
              title={intl.formatMessage({ id: translationId })}
              onPress={() => {
                navigation.push(EModalSettingRoutes.SettingListSubModal, {
                  name: translationId,
                });
              }}
            />
          ))}
        </ScrollView>
      </Page.Body>
    </Page>
  );
}
