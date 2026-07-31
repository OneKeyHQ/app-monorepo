import { Fragment, useMemo } from 'react';

import {
  Divider,
  Page,
  ScrollView,
  SizableText,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useConfigContext } from './configContext';
import {
  MobileTabSettingsDivider,
  TabSettingsListGrid,
  TabSettingsSection,
} from './ListItem';
import { useIsTabNavigator } from './useIsTabNavigator';

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
  const theme = useTheme();
  const isMobileLayout = platformEnv.isNative && !isTabNavigator;
  const headerStyle = useMemo(
    () =>
      isMobileLayout
        ? {
            backgroundColor: theme.bgSubdued.val,
          }
        : undefined,
    [isMobileLayout, theme.bgSubdued.val],
  );
  const config = useMemo(() => {
    return settingsConfig
      ? settingsConfig?.find((item) => item?.name === name)
      : null;
  }, [name, settingsConfig]);
  const configList = useMemo(() => {
    const visibleSectionIndexes = isTabNavigator
      ? undefined
      : config?.mobileVisibleSectionIndexes;
    return (
      config?.configs
        .map((items, index) => ({
          index,
          items,
          title: isTabNavigator
            ? config?.desktopSectionTitles?.[index]
            : undefined,
        }))
        .filter(
          ({ index, items }) =>
            (!visibleSectionIndexes || visibleSectionIndexes.includes(index)) &&
            items.some(Boolean),
        ) || []
    );
  }, [
    config?.configs,
    config?.desktopSectionTitles,
    config?.mobileVisibleSectionIndexes,
    isTabNavigator,
  ]);

  return (
    <Page
      scrollEnabled
      backgroundColor={isMobileLayout ? '$bgSubdued' : undefined}
    >
      <Page.Header
        headerStyle={headerStyle}
        title={titleFromProps || config?.title}
      />
      <Page.Body bg={isMobileLayout ? '$bgSubdued' : undefined}>
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
                  <TabSettingsSection
                    bg={isMobileLayout ? '$bg' : undefined}
                    borderWidth={isMobileLayout ? 0 : undefined}
                    borderRadius={isMobileLayout ? '$4' : undefined}
                  >
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
                  </TabSettingsSection>
                </YStack>
              ) : null;
            })}
          </YStack>
        </ScrollView>
      </Page.Body>
    </Page>
  );
}
