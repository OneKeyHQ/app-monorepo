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

import { type ISubSettingConfig } from './config';
import { navigateToSettingsTabInModal } from './navigateToSettingsTab';
import { useIsTabNavigator } from './useIsTabNavigator';

export function TabSettingsSection(props: IStackProps) {
  return (
    <YStack
      bg="$bgSubdued"
      overflow="hidden"
      borderRadius="$2.5"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$neutral3"
      {...(props as IYStackProps)}
    />
  );
}

export function MobileTabSettingsSection(props: IStackProps) {
  return (
    <TabSettingsSection bg="$bg" borderWidth={0} borderRadius="$4" {...props} />
  );
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

export function MobileTabSettingsDivider() {
  return (
    <XStack alignSelf="stretch" pl="$5">
      <Stack w="$6" mr="$3" flexShrink={0} />
      <Stack flex={1} h={StyleSheet.hairlineWidth} bg="$neutral3" />
    </XStack>
  );
}

export function TabSettingsListGrid({
  item,
  titleMatch,
  useMobilePresentation = false,
}: {
  item: ISubSettingConfig | undefined | null;
  titleMatch?: IFuseResultMatch | undefined;
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
  const valueTextProps = useMemo<ISizableTextProps | undefined>(
    () =>
      useMobilePresentation
        ? {
            size: '$bodyLg',
            color: '$textSubdued',
          }
        : undefined,
    [useMobilePresentation],
  );
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
  const title =
    (useMobilePresentation ? item?.mobileTitle : undefined) || item?.title;
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
      subtitle: item?.subtitle,
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
      py="$3"
      px="$5"
      mx={0}
      titleMatch={titleMatch}
      titleProps={titleProps}
      borderRadius={0}
      onPress={onPress}
      key={item?.icon ?? title}
      icon={item?.icon as IKeyOfIcons}
      iconProps={iconProps}
      title={title}
      subtitle={item?.subtitle}
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
