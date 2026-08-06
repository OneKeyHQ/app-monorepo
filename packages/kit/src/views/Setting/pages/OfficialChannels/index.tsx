import { Fragment } from 'react';

import { useIntl } from 'react-intl';

import { Page, ScrollView, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import {
  TabSettingsInsetDivider,
  TabSettingsListGrid,
  TabSettingsSection,
} from '../Tab/ListItem';
import { useOfficialChannels } from '../Tab/officialChannels';
import {
  SETTINGS_TAB_HEADER_TITLE_CONTAINER_STYLE,
  resolveSettingsSectionPresentation,
} from '../Tab/settingsSurface';
import { useSettingsLayout } from '../Tab/useIsTabNavigator';
import { useSettingsPageStyle } from '../Tab/useSettingsPageStyle';

export default function OfficialChannels() {
  const intl = useIntl();
  const { isMobileLayout, isTabNavigator } = useSettingsLayout();
  const channels = useOfficialChannels({
    includeMobileChannels: isMobileLayout,
  });
  const sectionPresentation = resolveSettingsSectionPresentation({
    isMobileLayout,
    isNative: Boolean(platformEnv.isNative),
    isTabNavigator,
  });
  const { headerBackgroundColor, headerStyle, pageBackgroundColor } =
    useSettingsPageStyle(sectionPresentation !== 'flat');
  const title = intl.formatMessage({
    id: ETranslations.official_channels__title,
  });

  return (
    <Page scrollEnabled backgroundColor={pageBackgroundColor}>
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
        title={title}
      />
      <Page.Body>
        <ScrollView contentContainerStyle={{ pb: '$10' }}>
          <YStack
            pl={sectionPresentation === 'tab' ? '$5' : '$4'}
            pr={sectionPresentation === 'tab' ? '$6' : '$4'}
            pt={isTabNavigator ? undefined : '$3'}
          >
            <TabSettingsSection presentation={sectionPresentation}>
              {channels.map((channel, index) => (
                <Fragment key={channel.id}>
                  <TabSettingsListGrid
                    item={{
                      id: channel.id,
                      icon: channel.icon,
                      isExternalLink: true,
                      onPress: () => openUrlExternal(channel.url),
                      testID: channel.testID,
                      title: channel.title,
                    }}
                    preferMobileNaming={isMobileLayout}
                    useMobilePresentation={isMobileLayout}
                  />
                  {index !== channels.length - 1 ? (
                    <TabSettingsInsetDivider />
                  ) : null}
                </Fragment>
              ))}
            </TabSettingsSection>
          </YStack>
        </ScrollView>
      </Page.Body>
    </Page>
  );
}
