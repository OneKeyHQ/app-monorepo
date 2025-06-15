import type { IStackStyle } from '@onekeyhq/components';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem as BaseListItem } from '@onekeyhq/kit/src/components/ListItem';

export function TabSettingsListItem(props: IListItemProps & IStackStyle) {
  return <BaseListItem py="$3" px="$5" mx={0} borderRadius={0} {...props} />;
}
