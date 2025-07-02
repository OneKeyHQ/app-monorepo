import { cloneElement, useCallback, useMemo } from 'react';

import { StyleSheet } from 'react-native';

import { Badge, SizableText, YStack } from '@onekeyhq/components';
import type {
  IBadgeProps,
  IIconProps,
  IKeyOfIcons,
  ISizableTextProps,
  IStackProps,
  IStackStyle,
} from '@onekeyhq/components';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem as BaseListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { dismissKeyboardWithDelay } from '@onekeyhq/shared/src/keyboard';
import type { IFuseResultMatch } from '@onekeyhq/shared/src/modules3rdParty/fuse';

import { type ISubSettingConfig } from './config';
import { useIsTabNavigator } from './useIsTabNavigator';

export function TabSettingsSection(props: IStackProps & IStackStyle) {
  return (
    <YStack
      bg="$bgSubdued"
      overflow="hidden"
      borderRadius="$2.5"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$neutral3"
      {...props}
    />
  );
}

export function TabSettingsListItem({
  subText,
  subTextProps,
  ...props
}: IListItemProps &
  IStackStyle &
  IStackProps & { subText?: string; subTextProps?: ISizableTextProps }) {
  return (
    <BaseListItem py="$3" px="$5" mx={0} borderRadius={0} {...props}>
      {subText ? <SizableText {...subTextProps}>{subText}</SizableText> : null}
    </BaseListItem>
  );
}

export function TabSettingsListGrid({
  item,
  titleMatch,
}: {
  item: ISubSettingConfig | undefined | null;
  titleMatch?: IFuseResultMatch | undefined;
}) {
  const isTabNavigator = useIsTabNavigator();
  const titleProps = useMemo(() => {
    return {
      size: (isTabNavigator
        ? '$bodyMdMedium'
        : '$bodyLgMedium') as ISizableTextProps['size'],
    };
  }, [isTabNavigator]);
  const iconProps = useMemo(() => {
    return {
      size: (isTabNavigator ? '$5' : '$6') as IIconProps['size'],
    };
  }, [isTabNavigator]);
  const appNavigation = useAppNavigation();
  const onPress = useCallback(async () => {
    await dismissKeyboardWithDelay(100);
    item?.onPress?.(appNavigation);
  }, [item, appNavigation]);
  return item?.renderElement ? (
    cloneElement(item.renderElement, {
      titleMatch,
      title: item.title,
      icon: item.icon as IKeyOfIcons,
      onPress: item?.onPress,
      badgeProps: item?.badgeProps,
      titleProps,
      iconProps,
    })
  ) : (
    <TabSettingsListItem
      py="$3"
      px="$5"
      mx={0}
      titleMatch={titleMatch}
      titleProps={titleProps}
      borderRadius={0}
      onPress={onPress}
      key={item?.icon ?? item?.title}
      icon={item?.icon as IKeyOfIcons}
      iconProps={iconProps}
      title={item?.title}
      drillIn
    >
      {item?.subText ? (
        <SizableText {...item.subTextProps}>{item.subText}</SizableText>
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
