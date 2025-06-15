import { useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { Divider, Page, YStack } from '@onekeyhq/components';
import { TabSubStackNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import type { ETranslations } from '@onekeyhq/shared/src/locale';

import { useSettingsConfig } from './config';
import { TabSettingsListItem } from './ListItem';

type ISettingName = ReturnType<
  typeof useSettingsConfig
>[number]['translationId'];

function Grid({
  item,
}: {
  item: ReturnType<typeof useSettingsConfig>[number]['configs'][number][number];
}) {
  const intl = useIntl();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return item?.renderElement ? (
    item.renderElement
  ) : (
    <TabSettingsListItem
      py="$3"
      px="$5"
      mx={0}
      borderRadius={0}
      onPress={item?.onPress}
      key={item?.icon ?? item?.translationId}
      icon={item?.icon as IKeyOfIcons}
      title={intl.formatMessage({
        id: (item?.translationId as ETranslations) ?? '',
      })}
      drillIn
    />
  );
}

export function SubSettingsPage({ name }: { name: ISettingName }) {
  const intl = useIntl();
  const settingsConfig = useSettingsConfig();
  const configList = useMemo(() => {
    return settingsConfig
      .find((item) => item.translationId === name)
      ?.configs.filter((item) => item && item.length);
  }, [name, settingsConfig]);
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
            const list = Array.isArray(item) ? item.filter(Boolean) : [];
            return list.length ? (
              <YStack
                key={index}
                bg="$bgSubdued"
                overflow="hidden"
                borderRadius="$2.5"
                borderWidth={StyleSheet.hairlineWidth}
                borderColor="$borderSubdued"
              >
                {list.map((i, idx) => {
                  return i ? (
                    <>
                      <Grid item={i} />
                      {idx !== list.length - 1 ? <Divider mx="$5" /> : null}
                    </>
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
