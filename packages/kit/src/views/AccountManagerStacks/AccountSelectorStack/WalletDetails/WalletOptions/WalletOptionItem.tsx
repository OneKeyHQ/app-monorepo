import type {
  IIconProps,
  IListItemProps,
  ITextProps,
} from '@onekeyhq/components';
import { Icon, ListItem, Spinner, Stack } from '@onekeyhq/components';

export function WalletOptionItem({
  label,
  labelColor,
  icon,
  iconColor = '$iconSubdued',
  isLoading,
  children,
  ...rest
}: Omit<IListItemProps, 'icon'> & {
  label: ITextProps['children'];
  labelColor?: ITextProps['color'];
  icon: IIconProps['name'];
  iconColor?: IIconProps['color'];
  isLoading?: boolean;
}) {
  return (
    <ListItem drillIn={!isLoading} {...rest}>
      <Stack px="$2">
        <Icon name={icon} color={iconColor} />
      </Stack>
      <ListItem.Text
        primary={label}
        flex={1}
        primaryTextProps={{
          color: labelColor || '$text',
        }}
      />
      {children}
      {isLoading && <Spinner />}
    </ListItem>
  );
}
