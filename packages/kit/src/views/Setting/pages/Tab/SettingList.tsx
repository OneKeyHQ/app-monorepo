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
  useTheme,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalSettingRoutes,
  ESettingsTabNames,
} from '@onekeyhq/shared/src/routes';

import { SettingTestIDs } from '../../testIDs';

import {
  type ISettingsConfig,
  type ISubSettingConfig,
  useSettingsConfig,
} from './config';
import { SocialButtonGroup } from './CustomElement';
import {
  MobileTabSettingsDivider,
  TabSettingsListGrid,
  TabSettingsListItem,
  TabSettingsSection,
} from './ListItem';
import { SearchView } from './SearchView';
import { useSearch } from './useSearch';

type ISettingCategory = NonNullable<ISettingsConfig[number]>;

type IMobileHomeEntry =
  | {
      type: 'category';
      key: string;
      config: ISettingCategory;
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
}: {
  config: ISettingCategory;
  useMobilePresentation?: boolean;
}) {
  const navigation = useAppNavigation();
  const title =
    (useMobilePresentation ? config.mobileTitle : undefined) || config.title;
  const icon =
    (useMobilePresentation ? config.mobileIcon : undefined) || config.icon;
  const iconProps = useMemo<IIconProps | undefined>(
    () =>
      useMobilePresentation
        ? {
            size: '$6',
            color: '$iconSubdued',
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
    });
  }, [navigation, title, config.name]);

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
      px="$5"
      titleProps={titleProps}
      onPress={handlePress}
    />
  );
}

function MobileSettingsSection({ entries }: { entries: IMobileHomeEntry[] }) {
  return (
    <TabSettingsSection bg="$bg" borderWidth={0} borderRadius="$4">
      {entries.map((entry, index) => (
        <Fragment key={entry.key}>
          {entry.type === 'category' ? (
            <SettingCategoryListItem
              config={entry.config}
              useMobilePresentation
            />
          ) : (
            <TabSettingsListGrid item={entry.config} useMobilePresentation />
          )}
          {index !== entries.length - 1 ? <MobileTabSettingsDivider /> : null}
        </Fragment>
      ))}
    </TabSettingsSection>
  );
}

export function SettingList() {
  const intl = useIntl();
  const theme = useTheme();
  const isMobileLayout = platformEnv.isNative;
  const headerStyle = useMemo(
    () =>
      isMobileLayout
        ? {
            backgroundColor: theme.bgSubdued.val,
          }
        : undefined,
    [isMobileLayout, theme.bgSubdued.val],
  );
  const settingsConfig = useSettingsConfig();
  const filteredSettingsConfig = useMemo(() => {
    return settingsConfig.filter((config): config is ISettingCategory =>
      Boolean(config && !config.isHidden),
    );
  }, [settingsConfig]);
  const mobileSections = useMemo(() => {
    const categoryMap = new Map(
      filteredSettingsConfig.map((config) => [config.name, config]),
    );
    const getCategoryEntry = (
      name: ESettingsTabNames,
    ): IMobileHomeEntry | undefined => {
      const config = categoryMap.get(name);
      return config
        ? {
            type: 'category',
            key: `category-${name}`,
            config,
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
            Boolean(item?.showOnMobileHome),
          ) || [];
      return items.map((item, index) => ({
        type: 'setting',
        key: `setting-${name}-${index}`,
        config: item,
      }));
    };

    const sections: IMobileHomeEntry[][] = [
      [
        getCategoryEntry(ESettingsTabNames.Backup),
        getCategoryEntry(ESettingsTabNames.Wallet),
        ...getPromotedEntries(ESettingsTabNames.Wallet),
      ].filter(isDefined),
      [
        getCategoryEntry(ESettingsTabNames.Security),
        ...getPromotedEntries(ESettingsTabNames.Security),
        getCategoryEntry(ESettingsTabNames.Network),
      ].filter(isDefined),
      [
        ...getPromotedEntries(ESettingsTabNames.Preferences),
        getCategoryEntry(ESettingsTabNames.Preferences),
      ].filter(isDefined),
      [getCategoryEntry(ESettingsTabNames.About)].filter(isDefined),
      [getCategoryEntry(ESettingsTabNames.Dev)].filter(isDefined),
    ];
    return sections.filter((section) => section.length > 0);
  }, [filteredSettingsConfig]);
  const { onSearch, searchResult, isSearching } = useSearch();
  let content: ReactNode;
  if (isSearching) {
    content = <SearchView sections={searchResult} isSearching={isSearching} />;
  } else if (platformEnv.isNative) {
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
      backgroundColor={isMobileLayout ? '$bgSubdued' : undefined}
      safeAreaEnabled={!isMobileLayout}
    >
      <Page.Header
        headerShown
        headerStyle={headerStyle}
        title={intl.formatMessage({ id: ETranslations.global_settings })}
      />
      <Page.Body bg={isMobileLayout ? '$bgSubdued' : undefined}>
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
