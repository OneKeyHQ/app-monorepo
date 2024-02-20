import type { IIconProps, ISizableTextProps } from '@onekeyhq/components';
import { Icon, Spinner, Stack } from '@onekeyhq/components';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

export function WalletOptionItem({
  label,
  labelColor,
  icon,
  iconColor = '$iconSubdued',
  isLoading,
  children,
  drillIn,
  ...rest
}: Omit<IListItemProps, 'icon'> & {
  label: ISizableTextProps['children'];
  labelColor?: ISizableTextProps['color'];
  icon: IIconProps['name'];
  iconColor?: IIconProps['color'];
  isLoading?: boolean;
  drillIn?: boolean;
}) {
  return (
    <ListItem drillIn={drillIn ?? !isLoading} {...rest}>
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
