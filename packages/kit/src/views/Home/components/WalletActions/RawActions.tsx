import { Children } from 'react';

import { useIntl } from 'react-intl';

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
import { ETranslations } from '@onekeyhq/shared/src/locale';

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
  const intl = useIntl();
  return (
    <ActionItem
      label={intl.formatMessage({ id: ETranslations.global_buy })}
      icon="PlusLargeOutline"
      {...props}
    />
  );
}

function ActionSell(props: IActionItemsProps) {
  const intl = useIntl();
  return (
    <ActionItem
      label={intl.formatMessage({ id: ETranslations.global_sell })}
      icon="MinusLargeOutline"
      {...props}
    />
  );
}

function ActionSend(props: IActionItemsProps) {
  const intl = useIntl();
  return (
    <ActionItem
      label={intl.formatMessage({ id: ETranslations.global_send })}
      icon="ArrowTopOutline"
      {...props}
    />
  );
}

function ActionReceive(props: IActionItemsProps) {
  const intl = useIntl();
  return (
    <ActionItem
      label={intl.formatMessage({ id: ETranslations.global_receive })}
      icon="ArrowBottomOutline"
      {...props}
    />
  );
}

function ActionSwap(props: IActionItemsProps) {
  const intl = useIntl();
  return (
    <ActionItem
      label={intl.formatMessage({ id: ETranslations.global_swap })}
      icon="SwitchHorOutline"
      {...props}
    />
  );
}

function ActionMore({ sections }: { sections: IActionListProps['sections'] }) {
  const media = useMedia();
  const intl = useIntl();
  return (
    <ActionList
      title={intl.formatMessage({
        id: ETranslations.global_more,
      })}
      floatingPanelProps={{
        w: '$60',
      }}
      renderTrigger={
        <ActionItem
          icon="DotHorOutline"
          {...(media.sm && {
            label: intl.formatMessage({
              id: ETranslations.global_more,
            }),
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
      pt="$5"
      $gtSm={{
        justifyContent: 'unset',
        space: '$2',
      }}
      {...rest}
    >
      {Children.toArray(children)}
    </XStack>
  );
}

RawActions.More = ActionMore;
RawActions.Buy = ActionBuy;
RawActions.Sell = ActionSell;
RawActions.Send = ActionSend;
RawActions.Receive = ActionReceive;
RawActions.Swap = ActionSwap;

export { RawActions, ActionItem };
