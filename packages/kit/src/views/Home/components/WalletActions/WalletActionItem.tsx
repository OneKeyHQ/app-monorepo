import type {
  IButtonProps,
  IIconButtonProps,
  IKeyOfIcons,
} from '@onekeyhq/components';
import {
  Button,
  IconButton,
  SizableText,
  Stack,
  useMedia,
} from '@onekeyhq/components';

type IActionItemsProps = {
  icon?: IKeyOfIcons;
  label?: string;
} & Partial<IButtonProps & IIconButtonProps>;

export function WalletActionItems({
  icon = 'PlaceholderOutline',
  label,
  ...rest
}: IActionItemsProps) {
  const media = useMedia();

  if (media.gtSm) {
    return (
      <Button
        {...(!label && {
          icon,
          py: '$2',
          pl: '$2.5',
          pr: '$0.5',
        })}
        {...rest}
      >
        {label}
      </Button>
    );
  }

  return (
    <Stack>
      <IconButton size="large" icon={icon} {...rest} />
      <SizableText
        mt="$2"
        textAlign="center"
        size="$bodySm"
        color="$textSubdued"
      >
        {label}
      </SizableText>
    </Stack>
  );
}
