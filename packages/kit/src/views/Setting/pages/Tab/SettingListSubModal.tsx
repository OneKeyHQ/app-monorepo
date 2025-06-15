import { useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Divider, Page, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSettingRoutes,
  IModalSettingParamList,
} from '@onekeyhq/shared/src/routes';

import { useIsTabNavigator, useSettingsConfig } from './config';
import { SocialButtonGroup } from './CustomElement';
import { TabSettingsListGrid, TabSettingsSection } from './ListItem';

import type { RouteProp } from '@react-navigation/core';

type ISettingName = string;

export function SubSettingsPage({ name }: { name: ISettingName }) {
  const intl = useIntl();
  const settingsConfig = useSettingsConfig();
  const isTabNavigator = useIsTabNavigator();
  const configList = useMemo(() => {
    return settingsConfig
      .find((item) => item?.title === name)
      ?.configs.filter((item) => item && item.length);
  }, [name, settingsConfig]);
  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: name as ETranslations,
        })}
      />
      <Page.Body>
        <YStack gap="$4" px="$4">
          {configList?.map((item) => {
            const list = Array.isArray(item) ? item.filter(Boolean) : [];
            return list.length ? (
              <TabSettingsSection>
                {list.map((i, idx) => {
                  return i ? (
                    <>
                      <TabSettingsListGrid item={i} />
                      {idx !== list.length - 1 ? <Divider mx="$5" /> : null}
                    </>
                  ) : null;
                })}
              </TabSettingsSection>
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
