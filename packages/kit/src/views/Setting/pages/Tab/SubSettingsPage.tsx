import { Fragment, useMemo } from 'react';

import { Divider, Page, ScrollView, YStack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ESettingsTabNames } from '@onekeyhq/shared/src/routes';

import { useConfigContext } from './configContext';
import { MobileAboutHeader } from './CustomElement';
import {
  TabSettingsInsetDivider,
  TabSettingsListGrid,
  TabSettingsSection,
} from './ListItem';
import { getSettingsDisplayTitle } from './settingsDisplay';
import {
  SETTINGS_PAGE_CONTENT_PADDING_X,
  SETTINGS_TAB_HEADER_TITLE_CONTAINER_STYLE,
  isVisibleSubSettingsItem,
  resolveSettingsSectionPresentation,
} from './settingsSurface';
import { useSettingsLayout } from './useIsTabNavigator';
import { useSettingsPageStyle } from './useSettingsPageStyle';

import type { ISettingsConfig, ISubSettingConfig } from './config';
import type { RouteProp } from '@react-navigation/native';

type ISettingName = string;

export function SubSettingsPage({
  name: nameFromProps,
  title: titleFromProps,
  settingsConfig: settingsConfigFromProps,
  route,
}: {
  name?: ISettingName;
  title?: string;
  settingsConfig?: ISettingsConfig;
} & { route?: RouteProp<any, any> }) {
  const { settingsConfig: contextSettingsConfig, insideTabNavigator } =
    useConfigContext();
  const name = (route?.name as string) || nameFromProps;
  const settingsConfig = useMemo(() => {
    return contextSettingsConfig.length
      ? contextSettingsConfig
      : (settingsConfigFromProps ?? []);
  }, [contextSettingsConfig, settingsConfigFromProps]);
  const { isTabNavigator, isMobileLayout, preferMobileNaming } =
    useSettingsLayout();
  const sectionPresentation = resolveSettingsSectionPresentation({
    isMobileLayout,
    isNative: Boolean(platformEnv.isNative),
    isTabNavigator,
  });
  const { headerBackgroundColor, headerStyle, pageBackgroundColor } =
    useSettingsPageStyle(sectionPresentation !== 'flat');
  const config = useMemo(() => {
    return settingsConfig.find((item) => item?.name === name);
  }, [name, settingsConfig]);
  const configList = useMemo(() => {
    return (
      config?.configs
        .map((items) =>
          items.filter((item): item is ISubSettingConfig => {
            if (!item) {
              return false;
            }
            return isVisibleSubSettingsItem({
              hasDesktopTab: Boolean(item.desktopTab),
              isMobileHome: Boolean(item.mobileHome),
              isTabNavigator,
              isMobileLayout,
            });
          }),
        )
        .filter((items) => items.length > 0) || []
    );
  }, [config?.configs, isMobileLayout, isTabNavigator]);
  const isMobileAboutPage =
    isMobileLayout && config?.name === ESettingsTabNames.About;

  // Page must not scroll: the inner ScrollView owns scrolling so iPad's
  // contentInsetAdjustmentBehavior applies to the right scroller (#12813).
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
        title={
          titleFromProps ||
          (config
            ? getSettingsDisplayTitle(config, preferMobileNaming)
            : undefined)
        }
      />
      <Page.Body>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ pb: '$10' }}
        >
          <YStack
            gap={isMobileLayout ? '$5' : '$4'}
            px={SETTINGS_PAGE_CONTENT_PADDING_X}
            pt={isTabNavigator ? undefined : '$3'}
          >
            {config
              ? configList.map((list, sectionIdx) => {
                  const showMobileAboutHeader =
                    isMobileAboutPage && sectionIdx === 0;
                  return (
                    <TabSettingsSection
                      key={sectionIdx}
                      presentation={sectionPresentation}
                    >
                      {showMobileAboutHeader ? (
                        <>
                          <MobileAboutHeader />
                          <Divider borderColor="$neutral3" />
                        </>
                      ) : null}
                      {list.map((item, idx) => (
                        <Fragment key={idx}>
                          <TabSettingsListGrid
                            item={item}
                            preferMobileNaming={preferMobileNaming}
                            useMobilePresentation={isMobileLayout}
                            analyticsSource={
                              insideTabNavigator ? 'sidebar' : 'categoryPage'
                            }
                            analyticsCategory={config.name}
                          />
                          {idx !== list.length - 1 ? (
                            <TabSettingsInsetDivider />
                          ) : null}
                        </Fragment>
                      ))}
                    </TabSettingsSection>
                  );
                })
              : null}
          </YStack>
        </ScrollView>
      </Page.Body>
    </Page>
  );
}
