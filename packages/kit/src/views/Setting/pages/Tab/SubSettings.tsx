import { useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { Page, XStack, YStack } from '@onekeyhq/components';
import { TabSubStackNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import type { ETranslations } from '@onekeyhq/shared/src/locale';

import { ListItem } from '../../../../components/ListItem';

import { SettingsConfig } from './config';

type ISettingName = (typeof SettingsConfig)[number]['translationId'];

export function SubSettingsPage({ name }: { name: ISettingName }) {
  const intl = useIntl();
  const configList = useMemo(() => {
    return SettingsConfig.find((item) => item.translationId === name)?.configs;
  }, [name]);
  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: name,
        })}
      />
      <Page.Body>
        <YStack gap="$4" px="$4">
          {configList?.map((item, index) => {
            return Array.isArray(item) && item.length ? (
              <YStack
                key={index}
                bg="$bgSubdued"
                borderRadius="$2.5"
                borderWidth={StyleSheet.hairlineWidth}
                borderColor="$borderSubdued"
              >
                {item.map((i) => {
                  return i ? (
                    <ListItem
                      key={i?.icon ?? index}
                      icon={i?.icon as IKeyOfIcons}
                      title={intl.formatMessage({
                        id: (i?.translationId as ETranslations) ?? '',
                      })}
                      drillIn
                    />
                  ) : null;
                })}
              </YStack>
            ) : null;
          })}
        </YStack>
      </Page.Body>
    </Page>
  );
}

export function SubSettings({ name }: { name: ISettingName }) {
  return (
    <TabSubStackNavigator
      // eslint-disable-next-line react/no-unstable-nested-components
      config={[{ name, component: () => <SubSettingsPage name={name} /> }]}
    />
  );
}
