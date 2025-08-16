import type { ReactNode } from 'react';
import { Children } from 'react';

import { useIntl } from 'react-intl';

import type {
  IActionListProps,
  IButtonProps,
  IIconButtonProps,
  IKeyOfIcons,
  IStackProps,
  IXStackProps,
} from '@onekeyhq/components';
import {
  ActionList,
  Button,
  IconButton,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export type IActionItemsProps = {
  icon?: IKeyOfIcons;
  label?: string | ReactNode;
  showButtonStyle?: boolean;
  hiddenIfDisabled?: boolean;
  verticalContainerProps?: IStackProps;
} & Partial<Omit<IButtonProps, 'type'> & Omit<IIconButtonProps, 'type'>>;

function ActionItem({
  icon = 'PlaceholderOutline',
  label,
  verticalContainerProps,
  showButtonStyle = false,
  ...rest
}: IActionItemsProps) {
  if (showButtonStyle) {
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
    <Stack alignItems="center" maxWidth={50} {...verticalContainerProps}>
      <IconButton size="large" icon={icon} {...rest} />
      <SizableText
        mt="$2"
        textAlign="center"
        size="$bodySm"
        color="$textSubdued"
        minWidth="$20"
        numberOfLines={1}
        {...(rest.disabled && {
          color: '$textDisabled',
        })}
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
      label={intl.formatMessage({ id: ETranslations.global_cash_out })}
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
      icon="SwapHorOutline"
      {...props}
    />
  );
}

function ActionBridge(props: IActionItemsProps) {
  const intl = useIntl();
  return (
    <ActionItem
      label={intl.formatMessage({ id: ETranslations.swap_page_bridge })}
      icon="BridgeOutline"
      {...props}
    />
  );
}

function ActionEarn(props: IActionItemsProps) {
  const intl = useIntl();
  return (
    <ActionItem
      label={intl.formatMessage({ id: ETranslations.global_earn })}
      icon="CoinsOutline"
      {...props}
    />
  );
}

function ActionMore({
  renderItemsAsync,
}: {
  renderItemsAsync: IActionListProps['renderItemsAsync'];
}) {
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
          label={intl.formatMessage({
            id: ETranslations.global_more,
          })}
        />
      }
      renderItemsAsync={renderItemsAsync}
    />
  );
}

function RawActions({ children, ...rest }: IXStackProps) {
  return (
    <XStack
      justifyContent="space-between"
      $gtSm={{
        flexDirection: 'row', // override the 'column' direction set in packages/kit/src/views/AssetDetails/pages/TokenDetails/TokenDetailsHeader.tsx 205L
        justifyContent: 'flex-start',
        gap: '$6',
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
RawActions.Bridge = ActionBridge;
RawActions.Earn = ActionEarn;

export { RawActions, ActionItem };
