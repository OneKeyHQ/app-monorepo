import { Fragment, useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Empty,
  Page,
  ScrollView,
  SizableText,
  YStack,
} from '@onekeyhq/components';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  MobileTabSettingsSection,
  TabSettingsInsetDivider,
  TabSettingsListGrid,
  TabSettingsSection,
} from './ListItem';
import {
  SETTINGS_PAGE_CONTENT_PADDING_X,
  SETTINGS_TAB_HEADER_TITLE_CONTAINER_STYLE,
  resolveSettingsSectionPresentation,
} from './settingsSurface';
import { useSettingsLayout } from './useIsTabNavigator';
import { useSettingsPageStyle } from './useSettingsPageStyle';

import type { ISettingsSearchResult } from './useSearch';

export function SearchView({
  results,
  isSearching,
}: {
  results: ISettingsSearchResult[];
  isSearching: boolean;
}) {
  const intl = useIntl();
  const { isMobileLayout, isTabNavigator, preferMobileNaming } =
    useSettingsLayout();
  const sectionPresentation = resolveSettingsSectionPresentation({
    isMobileLayout,
    isNative: Boolean(platformEnv.isNative),
    isTabNavigator,
  });
  if (!isSearching) {
    return null;
  }
  if (!results.length) {
    return (
      <YStack flex={1} ai="center" jc="center">
        <Empty
          illustration="SearchDocument"
          title={intl.formatMessage({
            id: ETranslations.global_no_results,
          })}
        />
      </YStack>
    );
  }
  const rows = results.map((result, index) => (
    <Fragment
      key={`${result.item.sectionName}-${
        result.item.id ??
        result.item.settingRoute ??
        result.item.desktopTab ??
        `${result.item.title}-${index}`
      }`}
    >
      <TabSettingsListGrid
        item={result.item}
        matches={result.matches}
        preferMobileNaming={preferMobileNaming}
        searchPath={result.item.sectionTitle}
        useMobilePresentation={isMobileLayout}
      />
      {index !== results.length - 1 ? <TabSettingsInsetDivider /> : null}
    </Fragment>
  ));
  return isMobileLayout ? (
    <YStack px={SETTINGS_PAGE_CONTENT_PADDING_X} pt="$2">
      <MobileTabSettingsSection>{rows}</MobileTabSettingsSection>
    </YStack>
  ) : (
    <YStack px={SETTINGS_PAGE_CONTENT_PADDING_X}>
      <TabSettingsSection presentation={sectionPresentation}>
        {rows}
      </TabSettingsSection>
    </YStack>
  );
}

export function SearchViewPage() {
  const intl = useIntl();
  const { isMobileLayout, isTabNavigator } = useSettingsLayout();
  const sectionPresentation = resolveSettingsSectionPresentation({
    isMobileLayout,
    isNative: Boolean(platformEnv.isNative),
    isTabNavigator,
  });
  const { headerBackgroundColor, headerStyle, pageBackgroundColor } =
    useSettingsPageStyle(sectionPresentation === 'tab');
  const [searchText, setSearchText] = useState('');
  const [searchResult, setSearchResult] = useState<ISettingsSearchResult[]>([]);

  useEffect(() => {
    const callback = (
      payload: IAppEventBusPayload[EAppEventBusNames.SettingsSearchResult],
    ) => {
      // The bus keeps search items opaque so shared stays decoupled from kit;
      // this pane is the emitting feature's own consumer, so narrowing is safe.
      setSearchResult(payload.list as ISettingsSearchResult[]);
      setSearchText(payload.searchText);
    };
    appEventBus.on(EAppEventBusNames.SettingsSearchResult, callback);
    return () => {
      appEventBus.off(EAppEventBusNames.SettingsSearchResult, callback);
    };
  }, []);
  const isSearching = searchText.length > 0;
  const renderHeaderTitle = useCallback(() => {
    return (
      <SizableText color="$textSubdued" size="$headingLg">
        {intl.formatMessage(
          {
            id: ETranslations.settings_search_title,
          },
          {
            keyword: (
              <SizableText color="$text" size="$headingLg">
                {searchText}
              </SizableText>
            ),
          },
        )}
      </SizableText>
    );
  }, [intl, searchText]);
  return (
    <Page backgroundColor={pageBackgroundColor}>
      <Page.Header
        {...(headerBackgroundColor
          ? { headerContainerBackgroundColor: headerBackgroundColor }
          : undefined)}
        {...(sectionPresentation === 'tab'
          ? {
              headerTitleContainerStyle:
                SETTINGS_TAB_HEADER_TITLE_CONTAINER_STYLE,
            }
          : undefined)}
        headerStyle={headerStyle}
        headerTitle={renderHeaderTitle}
      />
      <Page.Body>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ pb: '$10' }}
        >
          <SearchView isSearching={isSearching} results={searchResult} />
        </ScrollView>
      </Page.Body>
    </Page>
  );
}
