import type {
  IActionListProps,
  IButtonProps,
  IIconButtonProps,
  IKeyOfIcons,
  IXStackProps,
} from '@onekeyhq/components';
import {
  ActionList,
  Button,
  IconButton,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';

type IActionItemsProps = {
  icon?: IKeyOfIcons;
  label?: string;
} & Partial<IButtonProps & IIconButtonProps>;

function ActionItem({
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

function ActionBuy({ onPress }: { onPress: () => void }) {
  return <ActionItem label="Buy" onPress={onPress} icon="PlusLargeOutline" />;
}

function ActionSell({ onPress }: { onPress: () => void }) {
  return <ActionItem label="Sell" onPress={onPress} icon="MinusLargeOutline" />;
}

function ActionSend({ onPress }: { onPress: () => void }) {
  return <ActionItem label="Send" onPress={onPress} icon="ArrowTopOutline" />;
}

function ActionReceive({ onPress }: { onPress: () => void }) {
  return (
    <ActionItem label="Receive" onPress={onPress} icon="ArrowBottomOutline" />
  );
}

function ActionSwap({ onPress }: { onPress: () => void }) {
  return <ActionItem label="Swap" onPress={onPress} icon="SwitchHorOutline" />;
}

function ActionMore({ sections }: { sections: IActionListProps['sections'] }) {
  const media = useMedia();

  return (
    <ActionList
      title="More"
      renderTrigger={
        <ActionItem
          icon="DotHorOutline"
          {...(media.sm && {
            label: 'More',
          })}
        />
      }
      sections={sections}
    />
  );
}

function RawActions({ children, ...rest }: IXStackProps) {
  return (
    <XStack
      justifyContent="space-between"
      $gtSm={{
        justifyContent: 'unset',
        space: '$2',
      }}
      {...rest}
    >
      {children}
    </XStack>
  );
}

RawActions.More = ActionMore;
RawActions.Buy = ActionBuy;
RawActions.Sell = ActionSell;
RawActions.Send = ActionSend;
RawActions.Receive = ActionReceive;
RawActions.Swap = ActionSwap;

export { RawActions };
