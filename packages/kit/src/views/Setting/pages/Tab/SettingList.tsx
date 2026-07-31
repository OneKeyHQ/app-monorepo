import { Fragment, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import type {
  IIconProps,
  IKeyOfIcons,
  ISizableTextProps,
} from '@onekeyhq/components';
import {
  Page,
  ScrollView,
  SearchBar,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EMobileSettingsSubpage,
  EModalSettingRoutes,
  ESettingsTabNames,
} from '@onekeyhq/shared/src/routes';

import { SettingTestIDs } from '../../testIDs';

import {
  type ISettingsConfig,
  type ISubSettingConfig,
  getMobileSettingsPresentation,
  useSettingsConfig,
} from './config';
import { SocialButtonGroup } from './CustomElement';
import {
  MobileTabSettingsDivider,
  MobileTabSettingsSection,
  TabSettingsListGrid,
  TabSettingsListItem,
} from './ListItem';
import { SearchView } from './SearchView';
import { useIsTabNavigator } from './useIsTabNavigator';
import { useMobileSettingsPageStyle } from './useMobileSettingsPageStyle';
import { useSearch } from './useSearch';

type ISettingCategory = NonNullable<ISettingsConfig[number]>;

type IMobileHomeEntry =
  | {
      type: 'category';
      key: string;
      config: ISettingCategory;
      mobileSubpage?: EMobileSettingsSubpage;
    }
  | {
      type: 'setting';
      key: string;
      config: ISubSettingConfig;
    };

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function SettingCategoryListItem({
  config,
  useMobilePresentation = false,
  mobileSubpage,
}: {
  config: ISettingCategory;
  useMobilePresentation?: boolean;
  mobileSubpage?: EMobileSettingsSubpage;
}) {
  const navigation = useAppNavigation();
  const mobilePresentation = useMobilePresentation
    ? getMobileSettingsPresentation(config, { mobileSubpage })
    : undefined;
  const title = mobilePresentation?.title || config.title;
  const icon = mobilePresentation?.icon || config.icon;
  const iconProps = useMemo<IIconProps | undefined>(
    () =>
      useMobilePresentation
        ? {
            size: '$6',
            color: '$icon',
            ...config.tabBarIconStyle,
          }
        : config.tabBarIconStyle,
    [config.tabBarIconStyle, useMobilePresentation],
  );
  const titleProps = useMemo<ISizableTextProps | undefined>(
    () =>
      useMobilePresentation
        ? {
            ...config.tabBarLabelStyle,
            size: '$bodyLgMedium',
          }
        : config.tabBarLabelStyle,
    [config.tabBarLabelStyle, useMobilePresentation],
  );

  const handlePress = useCallback(() => {
    navigation.push(EModalSettingRoutes.SettingListSubModal, {
      title,
      name: config.name,
      mobileSubpage,
    });
  }, [navigation, title, config.name, mobileSubpage]);

  // Use custom tab item renderer if provided
  if (config.renderTabItem) {
    const CustomTabItem = config.renderTabItem;
    return <CustomTabItem onPress={handlePress} />;
  }

  return (
    <TabSettingsListItem
      testID={config.testID}
      {...config.tabBarItemStyle}
      drillIn
      showDot={config.showDot}
      key={config.title}
      icon={icon as IKeyOfIcons}
      iconProps={iconProps}
      title={title}
      subtitle={config.subtitle}
      px={useMobilePresentation ? '$5' : '$7'}
      titleProps={titleProps}
      onPress={handlePress}
    />
  );
}

function MobileSettingsSection({ entries }: { entries: IMobileHomeEntry[] }) {
  return (
    <MobileTabSettingsSection>
      {entries.map((entry, index) => (
        <Fragment key={entry.key}>
          {entry.type === 'category' ? (
            <SettingCategoryListItem
              config={entry.config}
              useMobilePresentation
              mobileSubpage={entry.mobileSubpage}
            />
          ) : (
            <TabSettingsListGrid item={entry.config} useMobilePresentation />
          )}
          {index !== entries.length - 1 ? <MobileTabSettingsDivider /> : null}
        </Fragment>
      ))}
    </MobileTabSettingsSection>
  );
}

export function SettingList() {
  const intl = useIntl();
  const isTabNavigator = useIsTabNavigator();
  const isMobileLayout = Boolean(platformEnv.isNative && !isTabNavigator);
  const { headerStyle, pageBackgroundColor } =
    useMobileSettingsPageStyle(isMobileLayout);
  const settingsConfig = useSettingsConfig();
  const filteredSettingsConfig = useMemo(() => {
    return settingsConfig.filter((config): config is ISettingCategory =>
      Boolean(config && !config.isHidden && !config.desktopOnlyTab),
    );
  }, [settingsConfig]);
  const mobileSections = useMemo(() => {
    const categoryMap = new Map(
      filteredSettingsConfig.map((config) => [config.name, config]),
    );
    const getCategoryEntry = (
      name: ESettingsTabNames,
      mobileSubpage?: EMobileSettingsSubpage,
    ): IMobileHomeEntry | undefined => {
      const config = categoryMap.get(name);
      return config
        ? {
            type: 'category',
            key: `category-${name}-${mobileSubpage ?? 'root'}`,
            config,
            mobileSubpage,
          }
        : undefined;
    };
    const getPromotedEntries = (
      name: ESettingsTabNames,
    ): IMobileHomeEntry[] => {
      const config = categoryMap.get(name);
      const items =
        config?.configs
          .flat()
          .filter((item): item is ISubSettingConfig =>
            Boolean(item?.mobilePlacement === 'home'),
          ) || [];
      return items.map((item, index) => ({
        type: 'setting',
        key: `setting-${name}-${index}`,
        config: item,
      }));
    };

    const sections: IMobileHomeEntry[][] = [
      [
        getCategoryEntry(ESettingsTabNames.Wallet),
        getCategoryEntry(ESettingsTabNames.Backup),
        getCategoryEntry(ESettingsTabNames.Security),
      ].filter(isDefined),
      [
        ...getPromotedEntries(ESettingsTabNames.Security),
        getCategoryEntry(ESettingsTabNames.Network),
      ].filter(isDefined),
      [
        ...getPromotedEntries(ESettingsTabNames.Preferences),
        getCategoryEntry(
          ESettingsTabNames.Preferences,
          EMobileSettingsSubpage.General,
        ),
        getCategoryEntry(
          ESettingsTabNames.Preferences,
          EMobileSettingsSubpage.AppData,
        ),
      ].filter(isDefined),
      [
        ...getPromotedEntries(ESettingsTabNames.About),
        getCategoryEntry(ESettingsTabNames.About),
      ].filter(isDefined),
      [getCategoryEntry(ESettingsTabNames.Dev)].filter(isDefined),
    ];
    return sections.filter((section) => section.length > 0);
  }, [filteredSettingsConfig]);
  const { onSearch, searchResult, isSearching } = useSearch();
  let content: ReactNode;
  if (isSearching) {
    content = <SearchView sections={searchResult} isSearching={isSearching} />;
  } else if (isMobileLayout) {
    content = (
      <YStack gap="$5" px="$5" pt="$4">
        {mobileSections.map((section, index) => (
          <MobileSettingsSection key={index} entries={section} />
        ))}
      </YStack>
    );
  } else {
    content = filteredSettingsConfig.map((config) => (
      <SettingCategoryListItem key={config.title} config={config} />
    ));
  }
  return (
    <Page
      testID={SettingTestIDs.settingsPage}
      backgroundColor={pageBackgroundColor}
      safeAreaEnabled={!isMobileLayout}
    >
      <Page.Header
        headerShown
        headerStyle={headerStyle}
        title={intl.formatMessage({ id: ETranslations.global_settings })}
      />
      <Page.Body bg={pageBackgroundColor}>
        <XStack px="$5" pb={isMobileLayout ? '$2' : '$4'}>
          <SearchBar onSearchTextChange={onSearch} />
        </XStack>
        <YStack flex={1}>
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ pb: isMobileLayout ? '$4' : '$10' }}
          >
            {content}
          </ScrollView>
        </YStack>
        {isMobileLayout ? null : <SocialButtonGroup />}
      </Page.Body>
    </Page>
  );
}
