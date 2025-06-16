import { FuseResultMatch } from 'fuse.js';
import { StyleSheet } from 'react-native';

import { YStack } from '@onekeyhq/components';
import type {
  IKeyOfIcons,
  IStackProps,
  IStackStyle,
} from '@onekeyhq/components';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem as BaseListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { IFuseResultMatch } from '@onekeyhq/shared/src/modules3rdParty/fuse';

import type { ISubSettingConfig } from './config';

export function TabSettingsSection(props: IStackProps & IStackStyle) {
  return (
    <YStack
      bg="$bgSubdued"
      overflow="hidden"
      borderRadius="$2.5"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      {...props}
    />
  );
}

export function TabSettingsListItem(
  props: IListItemProps & IStackStyle & IStackProps,
) {
  return <BaseListItem py="$3" px="$5" mx={0} borderRadius={0} {...props} />;
}

export function TabSettingsListGrid({
  item,
  titleMatch,
}: {
  item: ISubSettingConfig | undefined | null;
  titleMatch?: IFuseResultMatch | undefined;
}) {
  return item?.renderElement ? (
    item.renderElement
  ) : (
    <TabSettingsListItem
      py="$3"
      px="$5"
      mx={0}
      titleMatch={titleMatch}
      borderRadius={0}
      onPress={item?.onPress}
      key={item?.icon ?? item?.title}
      icon={item?.icon as IKeyOfIcons}
      title={item?.title}
      drillIn
    />
  );
}
