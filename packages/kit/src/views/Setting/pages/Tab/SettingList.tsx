import { Fragment, useCallback, useEffect, useMemo } from 'react';
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
  getTokenValue,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { dismissKeyboardWithDelay } from '@onekeyhq/shared/src/keyboard';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalSettingRoutes,
  ESettingsTabNames,
} from '@onekeyhq/shared/src/routes';

import { SettingTestIDs } from '../../testIDs';

import {
  type ISettingCategoryConfig,
  type ISubSettingConfig,
  useSettingsConfig,
} from './config';
import {
  MobileSettingsVersionFooter,
  SocialButtonGroup,
} from './CustomElement';
import {
  MobileTabSettingsSection,
  TabSettingsInsetDivider,
  TabSettingsListGrid,
  TabSettingsListItem,
} from './ListItem';
import { SearchView } from './SearchView';
import {
  getSettingsDisplayIcon,
  getSettingsDisplayTitle,
} from './settingsDisplay';
import {
  isVisibleSettingsCategory,
  resolveSettingsRootInsets,
} from './settingsRootLayout';
import { useSettingsLayout } from './useIsTabNavigator';
import { useSearch } from './useSearch';
import { useSettingsPageStyle } from './useSettingsPageStyle';

type IMobileHomeEntry =
  | {
      type: 'category';
      key: string;
      config: ISettingCategoryConfig;
    }
  | {
      type: 'setting';
      key: string;
      config: ISubSettingConfig;
    };

function SettingCategoryListItem({
  config,
  useMobilePresentation = false,
}: {
  config: ISettingCategoryConfig;
  useMobilePresentation?: boolean;
}) {
  const navigation = useAppNavigation();
  const title = getSettingsDisplayTitle(config, useMobilePresentation);
  const icon = getSettingsDisplayIcon(config, useMobilePresentation);
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

  const handlePress = useCallback(async () => {
    // Match the sibling row paths: drop the search keyboard before pushing so
    // it does not linger over the pushed page (Android IME especially).
    await dismissKeyboardWithDelay(100);
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
            />
          ) : (
            <TabSettingsListGrid
              item={entry.config}
              preferMobileNaming
              useMobilePresentation
            />
          )}
          {index !== entries.length - 1 ? <TabSettingsInsetDivider /> : null}
        </Fragment>
      ))}
    </MobileTabSettingsSection>
  );
}

export function SettingList() {
  const intl = useIntl();
  const { isMobileLayout } = useSettingsLayout();
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const { pageSafeAreaEnabled, scrollBottomInset } = resolveSettingsRootInsets({
    isMobileLayout,
    isNativeAndroid: Boolean(platformEnv.isNativeAndroid),
    bottomInset: safeAreaBottom,
  });
  const mobileContentPaddingBottom =
    (getTokenValue('$4', 'size') as number) + scrollBottomInset;
  const { headerBackgroundColor, headerStyle, pageBackgroundColor } =
    useSettingsPageStyle(isMobileLayout);
  const settingsConfig = useSettingsConfig();
  const filteredSettingsConfig = useMemo(() => {
    return settingsConfig.filter(isVisibleSettingsCategory);
  }, [settingsConfig]);
  const { mobileSections, mobileHomeOrphans } = useMemo(() => {
    const categoryMap = new Map(
      filteredSettingsConfig.map((config) => [config.name, config]),
    );
    // The builders record what the cards literal below actually consumes so
    // the dev-only orphan check cannot drift from the real layout.
    const consumedCategories = new Set<ESettingsTabNames>();
    const promotedSources = new Set<ESettingsTabNames>();
    const getCategoryEntry = (
      name: ESettingsTabNames,
    ): IMobileHomeEntry | undefined => {
      consumedCategories.add(name);
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
      promotedSources.add(name);
      const config = categoryMap.get(name);
      const items =
        config?.configs
          .flat()
          .filter((item): item is ISubSettingConfig =>
            Boolean(item?.mobileHome),
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
      ].filter(Boolean),
      [
        ...getPromotedEntries(ESettingsTabNames.Security),
        getCategoryEntry(ESettingsTabNames.Network),
      ].filter(Boolean),
      [
        ...getPromotedEntries(ESettingsTabNames.Preferences),
        getCategoryEntry(ESettingsTabNames.Preferences),
        getCategoryEntry(ESettingsTabNames.AppData),
      ].filter(Boolean),
      [
        ...getPromotedEntries(ESettingsTabNames.About),
        getCategoryEntry(ESettingsTabNames.About),
      ].filter(Boolean),
      [getCategoryEntry(ESettingsTabNames.Dev)].filter(Boolean),
    ];
    return {
      mobileSections: sections.filter((section) => section.length > 0),
      // Mirror of the desktop sidebar orphan check: a visible category (or a
      // promoted item in a category the cards never scan) outside the literal
      // would be silently unreachable from the phone home.
      mobileHomeOrphans: platformEnv.isDev
        ? {
            categories: filteredSettingsConfig
              .filter((config) => !consumedCategories.has(config.name))
              .map((config) => config.name),
            promotedSources: filteredSettingsConfig
              .filter(
                (config) =>
                  !promotedSources.has(config.name) &&
                  config.configs.flat().some((item) => item?.mobileHome),
              )
              .map((config) => config.name),
          }
        : undefined,
    };
  }, [filteredSettingsConfig]);
  useEffect(() => {
    if (
      mobileHomeOrphans &&
      (mobileHomeOrphans.categories.length ||
        mobileHomeOrphans.promotedSources.length)
    ) {
      console.warn(
        '[settings] mobile home cards missing entries:',
        mobileHomeOrphans,
      );
    }
  }, [mobileHomeOrphans]);
  const { onSearch, searchResult, isSearching } = useSearch(settingsConfig);
  let content: ReactNode;
  if (isSearching) {
    content = <SearchView results={searchResult} isSearching={isSearching} />;
  } else if (isMobileLayout) {
    content = (
      <YStack gap="$5" px="$5" pt="$4">
        {mobileSections.map((section, index) => (
          <MobileSettingsSection key={index} entries={section} />
        ))}
        <MobileSettingsVersionFooter />
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
      safeAreaEnabled={pageSafeAreaEnabled}
    >
      <Page.Header
        headerShown
        {...(headerBackgroundColor
          ? { headerContainerBackgroundColor: headerBackgroundColor }
          : undefined)}
        headerStyle={headerStyle}
        title={intl.formatMessage({ id: ETranslations.global_settings })}
      />
      <Page.Body>
        <XStack px="$5" pb={isMobileLayout ? '$2' : '$4'}>
          <SearchBar onSearchTextChange={onSearch} />
        </XStack>
        <YStack flex={1}>
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              pb: isMobileLayout ? mobileContentPaddingBottom : '$10',
            }}
          >
            {content}
          </ScrollView>
        </YStack>
        {isMobileLayout ? null : <SocialButtonGroup />}
      </Page.Body>
    </Page>
  );
}
