import { Fragment, useMemo } from 'react';

import { Divider, Page, ScrollView, YStack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ESettingsTabNames } from '@onekeyhq/shared/src/routes';

import { useConfigContext } from './configContext';
import { MobileAboutHeader } from './CustomElement';
import {
  MobileTabSettingsDivider,
  MobileTabSettingsSection,
  TabSettingsInsetDivider,
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
  insideTabNavigator = false,
  route,
}: {
  name?: ISettingName;
  title?: string;
  settingsConfig?: ISettingsConfig;
  /**
   * True only when rendered as a settings tab pane. Standalone hosts (pushed
   * SettingListSubModal pages) have no sidebar, so items promoted to sidebar
   * tabs must stay visible there even on wide viewports.
   */
  insideTabNavigator?: boolean;
} & { route?: RouteProp<any, any> }) {
  const context = useConfigContext();
  const name = useMemo(() => {
    return (route?.name as string) || nameFromProps;
  }, [route?.name, nameFromProps]);
  const settingsConfig = useMemo(() => {
    return context.settingsConfig.length
      ? context.settingsConfig
      : (settingsConfigFromProps ?? []);
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
        .map((items) =>
          items.filter((item) => {
            if (!item) {
              return false;
            }
            if (
              insideTabNavigator &&
              item.desktopTab &&
              registeredTabNames.has(item.desktopTab)
            ) {
              // The item is promoted to its own sidebar tab in this host.
              return false;
            }
            if (!isMobileLayout) {
              return true;
            }
            return item.mobilePlacement !== 'home';
          }),
        )
        .filter((items) => items.length > 0) || []
    );
  }, [config?.configs, insideTabNavigator, isMobileLayout, registeredTabNames]);
  const isMobileAboutPage =
    isMobileLayout && config?.name === ESettingsTabNames.About;

  return (
    <Page scrollEnabled backgroundColor={pageBackgroundColor}>
      <Page.Header
        headerStyle={headerStyle}
        title={
          // Tab layouts follow the sidebar's mobile naming; list layouts
          // (extension popup) keep the legacy titles until the copy merge.
          titleFromProps ||
          (isMobileLayout || isTabNavigator
            ? config?.mobileTitle
            : undefined) ||
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
              const list = section.filter(Boolean);
              const showMobileAboutHeader =
                isMobileAboutPage && sectionIdx === 0;
              return list.length ? (
                <SettingsSection key={sectionIdx}>
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
                              <TabSettingsInsetDivider />
                            )}
                          </>
                        ) : null}
                      </Fragment>
                    ) : null;
                  })}
                </SettingsSection>
              ) : null;
            })}
          </YStack>
        </ScrollView>
      </Page.Body>
    </Page>
  );
}
