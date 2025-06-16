import { useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { call } from '@wagmi/core';

import { Divider, Page, YStack } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSettingRoutes,
  IModalSettingParamList,
} from '@onekeyhq/shared/src/routes';

import { useIsTabNavigator, useSettingsConfig } from './config';
import { SocialButtonGroup } from './CustomElement';
import { TabSettingsListGrid, TabSettingsSection } from './ListItem';
import { SearchView } from './SearchView';

import type { ISubSettingConfig } from './config';
import type { RouteProp } from '@react-navigation/core';
import type { FuseResult } from 'fuse.js';

type ISettingName = string;

export function SubSettingsPage({
  name,
  showSearchView = true,
}: {
  name: ISettingName;
  showSearchView?: boolean;
}) {
  const settingsConfig = useSettingsConfig();
  const isTabNavigator = useIsTabNavigator();
  const configList = useMemo(() => {
    return settingsConfig
      .find((item) => item?.title === name)
      ?.configs.filter((item) => item && item.length);
  }, [name, settingsConfig]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<
    {
      title: string;
      icon: string;
      configs: FuseResult<ISubSettingConfig>[];
    }[]
  >([]);
  useEffect(() => {
    if (showSearchView) {
      const callback = ({
        list,
        searchText,
      }: {
        list: {
          title: string;
          icon: string;
          configs: FuseResult<ISubSettingConfig>[];
        }[];
        searchText: string;
      }) => {
        setIsSearching(searchText?.length > 0);
        setSearchResult(list ?? []);
      };
      appEventBus.on(EAppEventBusNames.SettingsSearchResult, callback);
      return () => {
        appEventBus.off(EAppEventBusNames.SettingsSearchResult, callback);
      };
    }
  }, [showSearchView]);
  return (
    <Page scrollEnabled>
      <Page.Header title={name} />
      <Page.Body>
        <YStack gap="$4" px="$4">
          {isSearching ? (
            <SearchView sections={searchResult} isSearching={isSearching} />
          ) : (
            configList?.map((item) => {
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
            })
          )}
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
  return <SubSettingsPage name={name as ISettingName} showSearchView={false} />;
}
