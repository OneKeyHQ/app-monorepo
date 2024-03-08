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

function ActionBuy(props: IActionItemsProps) {
  return <ActionItem label="Buy" icon="PlusLargeOutline" {...props} />;
}

function ActionSell(props: IActionItemsProps) {
  return <ActionItem label="Sell" icon="MinusLargeOutline" {...props} />;
}

function ActionSend(props: IActionItemsProps) {
  return <ActionItem label="Send" icon="ArrowTopOutline" {...props} />;
}

function ActionReceive(props: IActionItemsProps) {
  return <ActionItem label="Receive" icon="ArrowBottomOutline" {...props} />;
}

function ActionSwap(props: IActionItemsProps) {
  return <ActionItem label="Swap" icon="SwitchHorOutline" {...props} />;
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
