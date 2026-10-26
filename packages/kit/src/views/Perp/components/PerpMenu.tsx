import { useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Icon,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  ActivityShortcutCard,
  MENU_SHORTCUT_GRID_PROPS,
} from '@onekeyhq/kit/src/components/ActivityHub/ActivityShortcutCard';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type IMenuPage = 'preferences' | 'layout' | 'positionActions';

export function PerpMenu({
  isPopover = false,
  layoutSettings,
  onOpenHistory,
  onOpenGuide,
  onOpenHelp,
  onOpenPortfolio,
  settingsContent,
  renderActivityCenter,
}: {
  isPopover?: boolean;
  layoutSettings?: {
    renderContent: (onOpenPositionActions: () => void) => ReactNode;
    positionActionsContent: ReactNode;
  };
  onOpenHistory: () => void;
  onOpenGuide?: () => void;
  onOpenHelp?: () => void;
  onOpenPortfolio?: () => void;
  settingsContent: ReactNode;
  renderActivityCenter?: () => ReactNode;
}) {
  const intl = useIntl();
  const { height } = useWindowDimensions();
  const [page, setPage] = useState<IMenuPage>();
  const [contentHeight, setContentHeight] = useState(0);
  const shortcuts: {
    id: string;
    label: ETranslations;
    icon: IKeyOfIcons;
    onPress?: () => void;
  }[] = [
    {
      id: 'settings',
      label: ETranslations.global_preferences,
      icon: 'SettingsOutline',
      onPress: () => setPage('preferences'),
    },
    {
      id: 'layout',
      label: ETranslations.perps_layout_settings__title,
      icon: 'LayoutDashboardOutline',
      onPress: layoutSettings ? () => setPage('layout') : undefined,
    },
    {
      id: 'history',
      label: ETranslations.global_history,
      icon: 'ClockTimeHistoryOutline',
      onPress: onOpenHistory,
    },
    {
      id: 'portfolio',
      label: ETranslations.global_portfolio,
      icon: 'ChartColumnarOutline',
      onPress: onOpenPortfolio,
    },
    {
      id: 'help',
      label: ETranslations.settings_contact_us,
      icon: 'HelpSupportOutline',
      onPress: onOpenHelp,
    },
    {
      id: 'guide',
      label: ETranslations.perp_guide_title,
      icon: 'BookOpenOutline',
      onPress: onOpenGuide,
    },
  ];

  let pageContent = settingsContent;
  let pageTitle = ETranslations.global_preferences;
  if (page === 'layout') {
    pageTitle = ETranslations.perps_layout_settings__title;
    pageContent = layoutSettings?.renderContent(() =>
      setPage('positionActions'),
    );
  } else if (page === 'positionActions') {
    pageTitle = ETranslations.perp_position_action_buttons__title;
    pageContent = layoutSettings?.positionActionsContent;
  }

  const shortcutCards = shortcuts
    .filter((item) => item.onPress)
    .map((item) => (
      <ActivityShortcutCard
        key={item.id}
        testID={`perp-mobile-menu-shortcut-${item.id}`}
        title={intl.formatMessage({ id: item.label })}
        iconName={item.icon}
        flexBasis={isPopover ? '33.333333%' : '25%'}
        showIconBackground
        menuLayout
        onPress={() => item.onPress?.()}
      />
    ));

  return (
    <YStack testID="perp-mobile-menu" py={isPopover ? '$3' : '$0'}>
      {page ? (
        <XStack px="$5" alignItems="center" gap="$2">
          <XStack
            testID="perp-mobile-menu-back"
            alignItems="center"
            gap="$2"
            minHeight="$11"
            flexShrink={1}
            px="$2"
            ml="$-2"
            borderRadius="$2"
            accessibilityRole="button"
            accessibilityLabel={intl.formatMessage({
              id: ETranslations.global_back,
            })}
            focusable
            cursor="pointer"
            hoverStyle={{ opacity: 0.8 }}
            pressStyle={{ opacity: 0.6 }}
            onPress={() =>
              setPage(page === 'positionActions' ? 'layout' : undefined)
            }
          >
            <Icon name="ChevronLeftOutline" size="$3" color="$text" />
            <SizableText size="$headingSm" flexShrink={1}>
              {intl.formatMessage({ id: pageTitle })}
            </SizableText>
          </XStack>
        </XStack>
      ) : null}
      {page ? (
        <ScrollView
          maxHeight={height * 0.6}
          flexGrow={0}
          bounces={false}
          alwaysBounceVertical={false}
          contentContainerStyle={{ pb: '$0' }}
        >
          {pageContent}
        </ScrollView>
      ) : (
        <ScrollView
          testID="perp-mobile-menu-content"
          maxHeight={height * 0.6}
          flexGrow={0}
          scrollEnabled={contentHeight > height * 0.6}
          bounces={false}
          alwaysBounceVertical={false}
          contentContainerStyle={{ pb: '$0' }}
          onContentSizeChange={(_width, measuredHeight) =>
            setContentHeight(Math.ceil(measuredHeight))
          }
        >
          {isPopover ? (
            <YStack pt="$3">
              <SizableText
                size="$headingXs"
                textTransform="none"
                letterSpacing={0}
                px="$5"
                color="$textSubdued"
              >
                {intl.formatMessage({
                  id: ETranslations.perps_menu_features__title,
                })}
              </SizableText>
              {settingsContent}
            </YStack>
          ) : (
            <YStack pt="$1">
              <SizableText size="$headingSm" px="$5">
                {intl.formatMessage({
                  id: ETranslations.perps_menu_features__title,
                })}
              </SizableText>
              <XStack {...MENU_SHORTCUT_GRID_PROPS} pb="$1.5">
                {shortcutCards}
              </XStack>
            </YStack>
          )}
          {renderActivityCenter ? (
            <YStack mt={isPopover ? '$1' : '$1.5'}>
              <SizableText
                size={isPopover ? '$headingXs' : '$headingSm'}
                textTransform="none"
                letterSpacing={0}
                px="$5"
                color={isPopover ? '$textSubdued' : '$text'}
              >
                {intl.formatMessage({
                  id: ETranslations.perps_menu_campaign_center__title,
                })}
              </SizableText>
              {renderActivityCenter()}
            </YStack>
          ) : null}
        </ScrollView>
      )}
    </YStack>
  );
}
