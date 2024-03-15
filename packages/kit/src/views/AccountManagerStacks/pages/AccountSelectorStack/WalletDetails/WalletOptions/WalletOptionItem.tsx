import type { IIconProps, ISizableTextProps } from '@onekeyhq/components';
import { Icon, Spinner, Stack } from '@onekeyhq/components';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

export function WalletOptionItem({
  label,
  description,
  icon,
  iconColor = '$iconSubdued',
  isLoading,
  children,
  drillIn,
  ...rest
}: Omit<IListItemProps, 'icon'> & {
  label: ISizableTextProps['children'];
  description?: string;
  labelColor?: ISizableTextProps['color'];
  icon?: IIconProps['name'];
  iconColor?: IIconProps['color'];
  isLoading?: boolean;
  drillIn?: boolean;
}) {
  return (
    <ListItem userSelect="none" {...rest}>
      {icon && (
        <Stack px="$2">
          <Icon name={icon} color={iconColor} />
        </Stack>
      )}
      <ListItem.Text primary={label} secondary={description} flex={1} />
      {children}
      {isLoading && <Spinner />}
    </ListItem>
  );
}
