import type { IPropsWithTestId } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

interface ISectionPressItem {
  title: string;
  onPress: () => void;
}

export function SectionPressItem({
  title,
  onPress,
  ...restProps
}: IPropsWithTestId<ISectionPressItem>) {
  return (
    <ListItem
      drillIn
      onPress={onPress}
      title={title}
      titleProps={{ color: '$textCritical' }}
      {...restProps}
    />
  );
}
