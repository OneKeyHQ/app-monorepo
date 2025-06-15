import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { YStack } from '@onekeyhq/components';
import type {
  IKeyOfIcons,
  type IStackProps,
  type IStackStyle,
} from '@onekeyhq/components';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem as BaseListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { ETranslations } from '@onekeyhq/shared/src/locale';

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
}: {
  item: ISubSettingConfig | undefined | null;
}) {
  const intl = useIntl();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return item?.renderElement ? (
    item.renderElement
  ) : (
    <TabSettingsListItem
      py="$3"
      px="$5"
      mx={0}
      borderRadius={0}
      onPress={item?.onPress}
      key={item?.icon ?? item?.translationId}
      icon={item?.icon as IKeyOfIcons}
      title={intl.formatMessage({
        id: (item?.translationId as ETranslations) ?? '',
      })}
      drillIn
    />
  );
}
