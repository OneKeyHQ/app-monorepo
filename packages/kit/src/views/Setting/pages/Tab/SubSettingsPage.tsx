import { Fragment, useMemo } from 'react';

import {
  Divider,
  Page,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ESettingsTabNames } from '@onekeyhq/shared/src/routes';

import { useConfigContext } from './configContext';
import { MobileAboutHeader } from './CustomElement';
import {
  MobileTabSettingsDivider,
  MobileTabSettingsSection,
  TabSettingsListGrid,
  TabSettingsSection,
} from './ListItem';
import { useIsTabNavigator } from './useIsTabNavigator';
import { useMobileSettingsPageStyle } from './useMobileSettingsPageStyle';

import type { ISettingsConfig } from './config';
import type { RouteProp } from '@react-navigation/native';

type ISettingName = string;

export function SubSettingsPage({
  name: nameFromProps,
  title: titleFromProps,
  settingsConfig: settingsConfigFromProps,
  route,
}: {
  name: ISettingName;
  title: string;
  settingsConfig: ISettingsConfig;
} & { route?: RouteProp<any, any> }) {
  const context = useConfigContext();
  const name = useMemo(() => {
    return (route?.name as string) || nameFromProps;
  }, [route?.name, nameFromProps]);
  const settingsConfig = useMemo(() => {
    return context.settingsConfig.length
      ? context.settingsConfig
      : settingsConfigFromProps;
  }, [context.settingsConfig, settingsConfigFromProps]);
  const isTabNavigator = useIsTabNavigator();
  const isMobileLayout = Boolean(platformEnv.isNative && !isTabNavigator);
  const { headerStyle, pageBackgroundColor } =
    useMobileSettingsPageStyle(isMobileLayout);
  const SettingsSection = isMobileLayout
    ? MobileTabSettingsSection
    : TabSettingsSection;
  const config = useMemo(() => {
    return settingsConfig
      ? settingsConfig?.find((item) => item?.name === name)
      : null;
  }, [name, settingsConfig]);
  const registeredTabNames = useMemo(
    () =>
      new Set(
        settingsConfig
          .filter(Boolean)
          .map((category) => category?.name as ESettingsTabNames),
      ),
    [settingsConfig],
  );
  const configList = useMemo(() => {
    return (
      config?.configs
        .map((items, index) => {
          const visibleItems = items.filter((item) => {
            if (!item) {
              return false;
            }
            if (
              isTabNavigator &&
              item.desktopTab &&
              registeredTabNames.has(item.desktopTab)
            ) {
              // The item is promoted to its own sidebar tab on this layout.
              return false;
            }
            if (!isMobileLayout) {
              return true;
            }
            return item.mobilePlacement !== 'home';
          });
          return {
            index,
            items: visibleItems,
            title: isTabNavigator
              ? config?.desktopSectionTitles?.[index]
              : undefined,
          };
        })
        .filter(({ items }) => items.length > 0) || []
    );
  }, [
    config?.configs,
    config?.desktopSectionTitles,
    isMobileLayout,
    isTabNavigator,
    registeredTabNames,
  ]);
  if (
    platformEnv.isDev &&
    config?.desktopSectionTitles &&
    config.desktopSectionTitles.length !== config.configs.length
  ) {
    // Titles are positionally coupled to config sections; a mismatch means a
    // section was added/removed without updating the titles.
    console.warn(
      `[settings] desktopSectionTitles length mismatch for ${config.name}`,
    );
  }
  const isMobileAboutPage =
    isMobileLayout && config?.name === ESettingsTabNames.About;

  return (
    <Page scrollEnabled backgroundColor={pageBackgroundColor}>
      <Page.Header
        headerStyle={headerStyle}
        title={
          titleFromProps ||
          (isMobileLayout ? config?.mobileTitle : undefined) ||
          config?.title
        }
      />
      <Page.Body bg={pageBackgroundColor}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ pb: '$10' }}
        >
          <YStack
            gap={isMobileLayout ? '$5' : '$4'}
            px="$4"
            pt={isTabNavigator ? undefined : '$3'}
          >
            {configList.map((section, sectionIdx) => {
              const list = section.items.filter(Boolean);
              const showMobileAboutHeader =
                isMobileAboutPage && sectionIdx === 0;
              return list.length ? (
                <YStack key={sectionIdx} gap={isMobileLayout ? '$1' : '$2'}>
                  {section.title ? (
                    <XStack
                      ai="center"
                      h="$8"
                      px={isMobileLayout ? '$5' : '$1'}
                    >
                      <SizableText size="$headingXs" color="$textSubdued">
                        {section.title}
                      </SizableText>
                    </XStack>
                  ) : null}
                  <SettingsSection>
                    {showMobileAboutHeader ? (
                      <>
                        <MobileAboutHeader />
                        <Divider borderColor="$neutral3" />
                      </>
                    ) : null}
                    {list.map((i, idx) => {
                      return i ? (
                        <Fragment key={idx}>
                          <TabSettingsListGrid
                            item={i}
                            useMobilePresentation={isMobileLayout}
                          />
                          {idx !== list.length - 1 ? (
                            <>
                              {isMobileLayout ? (
                                <MobileTabSettingsDivider />
                              ) : (
                                <XStack w="100%" px="$5">
                                  <Divider borderColor="$neutral3" />
                                </XStack>
                              )}
                            </>
                          ) : null}
                        </Fragment>
                      ) : null;
                    })}
                  </SettingsSection>
                </YStack>
              ) : null;
            })}
          </YStack>
        </ScrollView>
      </Page.Body>
    </Page>
  );
}
