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
  const { icon, label, ...rest } = props;
  return (
    <ActionItem
      label={label ?? intl.formatMessage({ id: ETranslations.global_buy })}
      icon={icon ?? 'PlusLargeOutline'}
      {...rest}
    />
  );
}

function ActionSell(props: IActionItemsProps) {
  const intl = useIntl();
  const { icon, label, ...rest } = props;
  return (
    <ActionItem
      label={label ?? intl.formatMessage({ id: ETranslations.global_cash_out })}
      icon={icon ?? 'MinusLargeOutline'}
      {...rest}
    />
  );
}

function ActionSend(props: IActionItemsProps) {
  const intl = useIntl();
  const { icon, label, ...rest } = props;
  return (
    <ActionItem
      label={label ?? intl.formatMessage({ id: ETranslations.global_send })}
      icon={icon ?? 'ArrowTopOutline'}
      {...rest}
    />
  );
}

function ActionReceive(props: IActionItemsProps) {
  const intl = useIntl();
  const { icon, label, ...rest } = props;
  return (
    <ActionItem
      label={label ?? intl.formatMessage({ id: ETranslations.global_receive })}
      icon={icon ?? 'ArrowBottomOutline'}
      {...rest}
    />
  );
}

function ActionSwap(props: IActionItemsProps) {
  const intl = useIntl();
  const { icon, label, ...rest } = props;
  return (
    <ActionItem
      label={label ?? intl.formatMessage({ id: ETranslations.global_swap })}
      icon={icon ?? 'SwapHorOutline'}
      {...rest}
    />
  );
}

function ActionBridge(props: IActionItemsProps) {
  const intl = useIntl();
  const { icon, label, ...rest } = props;
  return (
    <ActionItem
      label={
        label ?? intl.formatMessage({ id: ETranslations.swap_page_bridge })
      }
      icon={icon ?? 'BridgeOutline'}
      {...rest}
    />
  );
}

function ActionPerp(props: IActionItemsProps) {
  const intl = useIntl();
  const { icon, label, ...rest } = props;
  return (
    <ActionItem
      label={label ?? intl.formatMessage({ id: ETranslations.global_perp })}
      icon={icon ?? 'TradingViewCandlesOutline'}
      {...rest}
    />
  );
}

function ActionEarn(props: IActionItemsProps) {
  const intl = useIntl();
  const { icon, label, ...rest } = props;
  return (
    <ActionItem
      label={label ?? intl.formatMessage({ id: ETranslations.global_earn })}
      icon={icon ?? 'CoinsOutline'}
      {...rest}
    />
  );
}

function ActionStaking(props: IActionItemsProps) {
  const { icon, ...rest } = props;
  return <ActionItem icon={icon ?? 'Layers3Solid'} {...rest} />;
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
RawActions.Perp = ActionPerp;
RawActions.Earn = ActionEarn;
RawActions.Staking = ActionStaking;

export { RawActions, ActionItem };
