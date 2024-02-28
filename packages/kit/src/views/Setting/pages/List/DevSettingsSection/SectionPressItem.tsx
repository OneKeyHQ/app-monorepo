import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

interface ISectionPressItem {
  title: string;
  onPress: () => void;
}

export function SectionPressItem({ title, onPress }: ISectionPressItem) {
  return (
    <ListItem
      drillIn
      onPress={onPress}
      title={title}
      titleProps={{ color: '$textCritical' }}
    />
  );
}
