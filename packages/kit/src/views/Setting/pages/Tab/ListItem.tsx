import { cloneElement, useCallback, useMemo } from 'react';

import { StyleSheet } from 'react-native';

import { Badge, Icon, Stack, XStack, YStack } from '@onekeyhq/components';
import type {
  IBadgeProps,
  IIconProps,
  IKeyOfIcons,
  ISizableTextProps,
  IStackProps,
  IStackStyle,
  IYStackProps,
} from '@onekeyhq/components';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem as BaseListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { dismissKeyboardWithDelay } from '@onekeyhq/shared/src/keyboard';
import type { IFuseResultMatch } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { type ISubSettingConfig } from './config';
import { navigateToSettingsTabInModal } from './navigateToSettingsTab';
import {
  getSettingsDisplayTitle,
  getSettingsDisplayTitleKey,
} from './settingsDisplay';
import {
  type ISettingsSectionPresentation,
  resolveSettingsSectionSurface,
} from './settingsSurface';
import { useIsTabNavigator } from './useIsTabNavigator';

type ISettingsSectionProps = IStackProps & {
  presentation?: ISettingsSectionPresentation;
};

export function TabSettingsSection({
  presentation = 'flat',
  ...props
}: ISettingsSectionProps) {
  const surface = resolveSettingsSectionSurface(presentation);
  return (
    <YStack
      backgroundColor={surface.backgroundColor}
      overflow="hidden"
      borderRadius={surface.borderRadius}
      borderCurve={surface.borderCurve}
      borderWidth={StyleSheet.hairlineWidth * surface.borderWidthScale}
      borderColor={surface.borderColor}
      {...(props as IYStackProps)}
    />
  );
}

export function MobileTabSettingsSection(props: ISettingsSectionProps) {
  return <TabSettingsSection {...props} presentation="mobile" />;
}

export function TabSettingsListItem({
  showDot,
  children,
  ...props
}: IListItemProps & IStackStyle & { showDot?: boolean }) {
  return (
    <BaseListItem py="$3" px="$5" mx={0} borderRadius={0} {...props}>
      {children}
      {showDot ? (
        <Stack width="$2" height="$2" bg="$bgAccent" borderRadius="$full" />
      ) : null}
    </BaseListItem>
  );
}

/**
 * Hairline divider indented past the leading icon column so it starts at the
 * row text and bleeds to the card's right edge. By default the inset follows
 * TabSettingsListGrid's non-mobile icon sizing ($5 on tab-navigator layouts,
 * $6 on list layouts); mobile-presentation rows pass $6 explicitly.
 */
export function TabSettingsInsetDivider({
  iconWidth,
}: {
  iconWidth?: IStackProps['w'];
}) {
  const isTabNavigator = useIsTabNavigator();
  return (
    <XStack alignSelf="stretch" pl="$5">
      <Stack
        w={iconWidth ?? (isTabNavigator ? '$5' : '$6')}
        mr="$3"
        flexShrink={0}
      />
      <Stack flex={1} h={StyleSheet.hairlineWidth} bg="$neutral3" />
    </XStack>
  );
}

export function TabSettingsListGrid({
  item,
  matches,
  searchPath,
  useMobilePresentation = false,
  preferMobileNaming = useMobilePresentation,
}: {
  item: ISubSettingConfig | undefined | null;
  matches?: readonly IFuseResultMatch[];
  searchPath?: string;
  preferMobileNaming?: boolean;
  useMobilePresentation?: boolean;
}) {
  const isTabNavigator = useIsTabNavigator();
  const titleProps = useMemo(() => {
    return {
      size: (isTabNavigator
        ? '$bodyMdMedium'
        : '$bodyLgMedium') as ISizableTextProps['size'],
    };
  }, [isTabNavigator]);
  const valueTextProps = useMemo<ISizableTextProps | undefined>(() => {
    if (useMobilePresentation) {
      return {
        size: '$bodyLg',
        color: '$textSubdued',
      };
    }
    if (platformEnv.isDesktop) {
      return {
        size: '$bodyMd',
        color: '$textSubdued',
      };
    }
    return undefined;
  }, [useMobilePresentation]);
  const iconProps = useMemo(() => {
    if (useMobilePresentation) {
      return {
        size: '$6' as IIconProps['size'],
        color: '$icon' as IIconProps['color'],
      };
    }
    return {
      size: (isTabNavigator ? '$5' : '$6') as IIconProps['size'],
    };
  }, [isTabNavigator, useMobilePresentation]);
  const appNavigation = useAppNavigation();
  const title = item
    ? getSettingsDisplayTitle(item, preferMobileNaming)
    : undefined;
  const subtitle = searchPath ?? item?.subtitle;
  // Highlight the match for the field the row actually displays. Naming is a
  // separate axis from the compact/mobile row styling.
  // Match indices are raw offsets into the matched string, so picking the
  // wrong key paints the highlight onto foreign characters.
  const titleMatch = matches?.find(
    (match) =>
      match.key ===
      (item ? getSettingsDisplayTitleKey(item, preferMobileNaming) : 'title'),
  );
  const onPress = useCallback(async () => {
    await dismissKeyboardWithDelay(100);
    if (isTabNavigator && item?.desktopTab) {
      // On tab-navigator layouts this item lives as its own sidebar tab, so
      // select the tab instead of stacking the standalone page on top.
      navigateToSettingsTabInModal(item.desktopTab);
      return;
    }
    item?.onPress?.(appNavigation);
  }, [appNavigation, isTabNavigator, item]);
  return item?.renderElement ? (
    cloneElement(item.renderElement, {
      titleMatch,
      title,
      subtitle,
      icon: item.icon as IKeyOfIcons,
      onPress: item?.onPress,
      badgeProps: item?.badgeProps,
      testID: item?.testID,
      titleProps,
      valueTextProps,
      iconProps,
    })
  ) : (
    <TabSettingsListItem
      testID={item?.testID}
      titleMatch={titleMatch}
      titleProps={titleProps}
      onPress={onPress}
      key={item?.icon ?? title}
      icon={item?.icon as IKeyOfIcons}
      iconProps={iconProps}
      title={title}
      subtitle={subtitle}
      drillIn={!item?.isExternalLink}
    >
      {item?.isExternalLink ? (
        <Icon name="ArrowTopRightOutline" size="$5" color="$iconSubdued" />
      ) : null}
      {item?.badgeProps ? (
        <Badge
          badgeSize={item.badgeProps.badgeSize as IBadgeProps['badgeSize']}
        >
          <Badge.Text>{item.badgeProps.badgeText}</Badge.Text>
        </Badge>
      ) : null}
    </TabSettingsListItem>
  );
}
