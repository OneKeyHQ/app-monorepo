import type { IIconProps, ISizableTextProps } from '@onekeyhq/components';
import { Icon, Spinner, Stack } from '@onekeyhq/components';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

// type IWalletOptionItemProps = {
//   label: ISizableTextProps['children'];
//   labelColor?: ISizableTextProps['color'];
//   icon: IIconProps['name'];
//   iconColor?: IIconProps['color'];
//   isLoading?: boolean;
//   drillIn?: boolean;
// } & Omit<IListItemProps, 'icon'>;

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
    <ListItem userSelect="none" {...rest}>
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

// const NewWalletOptionItem = ListItem.styleable<IWalletOptionItemProps>(
//   (props, ref) => {
//     const {
//       label,
//       labelColor,
//       icon,
//       iconColor = '$iconSubdued',
//       isLoading,
//       children,
//       drillIn,
//       ...rest
//     } = props;

//     return (
//       <ListItem ref={ref} userSelect="none" {...rest}>
//         <Stack px="$2">
//           <Icon name={icon} color={iconColor} />
//         </Stack>
//         <ListItem.Text
//           primary={label}
//           flex={1}
//           primaryTextProps={{
//             color: labelColor || '$text',
//           }}
//         />
//         {children}
//         {isLoading && <Spinner />}
//       </ListItem>
//     );
//   },
// );
