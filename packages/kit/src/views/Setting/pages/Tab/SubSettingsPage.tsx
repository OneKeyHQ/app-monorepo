import { useMemo } from 'react';

import {
  Divider,
  Page,
  ScrollView,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { useConfigContext } from './configContext';
import { TabSettingsListGrid, TabSettingsSection } from './ListItem';
import { useIsTabNavigator } from './useIsTabNavigator';

import type { ISettingsConfig } from './config';
import type { RouteProp } from '@react-navigation/native';

type ISettingName = string;

export function SubSettingsPage({
  name: title,
  settingsConfig: settingsConfigFromProps,
  route,
}: {
  name: ISettingName;
  settingsConfig: ISettingsConfig;
} & { route?: RouteProp<any, any> }) {
  const context = useConfigContext();
  const name = useMemo(() => {
    return (route?.name as string) || title;
  }, [route?.name, title]);
  const settingsConfig = useMemo(() => {
    return context.settingsConfig.length
      ? context.settingsConfig
      : settingsConfigFromProps;
  }, [context.settingsConfig, settingsConfigFromProps]);
  const isTabNavigator = useIsTabNavigator();
  const configList = useMemo(() => {
    return settingsConfig
      ? settingsConfig
          ?.find((item) => item?.title === name)
          ?.configs.filter((item) => item && item.length)
      : [];
  }, [name, settingsConfig]);

  return (
    <Page>
      <Page.Header title={name} />
      <Page.Body>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ pb: '$10' }}
        >
          <YStack gap="$4" px="$4" pt={isTabNavigator ? undefined : '$3'}>
            {configList?.map((item) => {
              const list = Array.isArray(item) ? item.filter(Boolean) : [];
              return list.length ? (
                <TabSettingsSection>
                  {list.map((i, idx) => {
                    return i ? (
                      <>
                        <TabSettingsListGrid item={i} />
                        {idx !== list.length - 1 ? (
                          <XStack mx="$5">
                            <Divider borderColor="$neutral3" />
                          </XStack>
                        ) : null}
                      </>
                    ) : null;
                  })}
                </TabSettingsSection>
              ) : null;
            })}
          </YStack>
        </ScrollView>
      </Page.Body>
    </Page>
  );
}
