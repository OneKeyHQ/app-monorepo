import { ListItem } from '@onekeyhq/components';

export type IListItemSelectOption<T> = {
  value: T;
  title: string;
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
    <ListItem title={opt.title} onPress={() => onChange?.(opt.value)}>
      {value === opt.value ? (
        <ListItem.IconButton
          iconProps={{ 'color': '$iconActive' }}
          icon="CheckRadioSolid"
        />
      ) : null}
    </ListItem>
  ));
}
