import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

export type IListItemSelectOption<T> = {
  value: T;
  title: string;
  subtitle?: string;
};

export type IListItemSelectProps<T> = {
  value: string;
  options: IListItemSelectOption<T>[];
  onChange: (value: T) => void;
};

export function ListItemSelect<T>({
  value,
  options,
  onChange,
}: IListItemSelectProps<T>) {
  return options.map((opt) => (
    <ListItem
      key={opt.title}
      title={opt.title}
      subtitle={opt.subtitle}
      onPress={() => onChange?.(opt.value)}
    >
      {value === opt.value ? (
        <ListItem.IconButton
          iconProps={{ 'color': '$iconActive', size: '$6' }}
          icon="CheckRadioSolid"
        />
      ) : null}
    </ListItem>
  ));
}
