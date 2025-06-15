import { useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { RouteProps } from 'react-router-dom';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { Divider, Page, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSettingRoutes,
  IModalSettingParamList,
} from '@onekeyhq/shared/src/routes';

import { useIsTabNavigator, useSettingsConfig } from './config';
import { SocialButtonGroup } from './CustomElement';
import { TabSettingsListItem } from './ListItem';

import type { RouteProp } from '@react-navigation/core';

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
  const isTabNavigator = useIsTabNavigator();
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
        {isTabNavigator && name === ETranslations.global_about ? (
          <SocialButtonGroup />
        ) : null}
      </Page.Body>
    </Page>
  );
}

export default function SettingListSubModal() {
  const route =
    useRoute<
      RouteProp<IModalSettingParamList, EModalSettingRoutes.SettingListSubModal>
    >();
  const { name } = route.params || {};
  return <SubSettingsPage name={name as ISettingName} />;
}
