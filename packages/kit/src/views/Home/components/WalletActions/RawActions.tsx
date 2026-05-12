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
  Icon,
  IconButton,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export type IActionItemsProps = {
  icon?: IKeyOfIcons | null;
  label?: string | ReactNode;
  showButtonStyle?: boolean;
  hiddenIfDisabled?: boolean;
  allowPressWhenDisabled?: boolean;
  verticalContainerProps?: IStackProps;
} & Partial<
  Omit<IButtonProps, 'type' | 'icon'> & Omit<IIconButtonProps, 'type' | 'icon'>
>;

function ActionItem({
  icon = 'PlaceholderOutline',
  label,
  verticalContainerProps,
  showButtonStyle = false,
  allowPressWhenDisabled = false,
  onPress,
  disabled,
  ...rest
}: IActionItemsProps) {
  const visualDisabled = !!disabled;
  const effectiveDisabled = visualDisabled && !allowPressWhenDisabled;

  if (showButtonStyle) {
    return (
      <Button
        testID="home-action-item-btn"
        icon={icon || undefined}
        {...(!label && {
          py: '$2',
          pl: '$2.5',
          pr: '$0.5',
        })}
        onPress={onPress}
        disabled={effectiveDisabled}
        opacity={allowPressWhenDisabled && visualDisabled ? 0.4 : undefined}
        {...rest}
      >
        {label}
      </Button>
    );
  }

  return (
    <>
      {/* Mobile: Card style */}
      <Stack
        flex={1}
        flexBasis={0}
        alignItems="center"
        justifyContent="center"
        bg="$bgStrong"
        borderRadius="$4"
        pt="$2.5"
        pb="$1"
        px="$1"
        userSelect="none"
        hoverStyle={{ bg: '$bgStrongHover' }}
        pressStyle={{ bg: '$bgStrongActive' }}
        focusable
        focusVisibleStyle={{
          outlineColor: '$focusRing',
          outlineStyle: 'solid',
          outlineWidth: 2,
        }}
        $gtSm={{ display: 'none' }}
        {...(visualDisabled && { opacity: 0.4 })}
        {...verticalContainerProps}
        onPress={onPress}
        {...rest}
      >
        {icon ? (
          <Stack>
            <Icon
              name={icon}
              size="$6"
              color={visualDisabled ? '$iconDisabled' : '$icon'}
            />
          </Stack>
        ) : null}
        <SizableText
          my="$1"
          textAlign="center"
          size="$bodySm"
          color={visualDisabled ? '$textDisabled' : '$text'}
        >
          {label}
        </SizableText>
      </Stack>

      {/* Desktop: Pill button */}
      <Button
        testID="home-btn"
        variant="secondary"
        size="large"
        icon={icon || undefined}
        display="none"
        $gtSm={{ display: 'flex' }}
        onPress={onPress}
        disabled={effectiveDisabled}
        opacity={allowPressWhenDisabled && visualDisabled ? 0.4 : undefined}
        {...rest}
      >
        {label}
      </Button>
    </>
  );
}

function ActionBuy(props: IActionItemsProps) {
  const intl = useIntl();
  const { icon, label, ...rest } = props;
  return (
    <ActionItem
      label={label ?? intl.formatMessage({ id: ETranslations.buy_and_sell })}
      icon={icon ?? 'CurrencyDollarOutline'}
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
      icon={icon ?? 'SwitchHorOutline'}
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
      icon={icon ?? 'TradeOutline'}
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
  testID,
}: {
  renderItemsAsync: IActionListProps['renderItemsAsync'];
  testID?: string;
}) {
  const intl = useIntl();
  const label = intl.formatMessage({ id: ETranslations.global_more });

  const handleMobilePress = () => {
    ActionList.show({
      title: label,
      floatingPanelProps: { w: '$60' },
      renderItemsAsync,
    });
  };

  return (
    <>
      {/* Mobile: Card style - uses ActionList.show() so card can stretch properly */}
      <Stack
        flex={1}
        flexBasis={0}
        alignItems="center"
        justifyContent="center"
        bg="$bgStrong"
        borderRadius="$4"
        pt="$2.5"
        pb="$1"
        px="$1"
        userSelect="none"
        hoverStyle={{ bg: '$bgStrongHover' }}
        pressStyle={{ bg: '$bgStrongActive' }}
        focusable
        focusVisibleStyle={{
          outlineColor: '$focusRing',
          outlineStyle: 'solid',
          outlineWidth: 2,
        }}
        $gtSm={{ display: 'none' }}
        onPress={handleMobilePress}
        testID={testID}
      >
        <Stack>
          <Icon name="DotHorOutline" size="$6" color="$icon" />
        </Stack>
        <SizableText my="$1" textAlign="center" size="$bodySm" color="$text">
          {label}
        </SizableText>
      </Stack>

      {/* Desktop: Icon only button */}
      <Stack display="none" $gtSm={{ display: 'flex' }}>
        <ActionList
          title={label}
          floatingPanelProps={{ w: '$60' }}
          renderTrigger={
            <IconButton
              variant="secondary"
              size="large"
              icon="DotHorOutline"
              testID={testID}
            />
          }
          renderItemsAsync={renderItemsAsync}
        />
      </Stack>
    </>
  );
}

function RawActions({ children, ...rest }: IXStackProps) {
  return (
    <XStack
      gap="$2"
      $gtSm={{
        flexDirection: 'row', // override the 'column' direction set in packages/kit/src/views/AssetDetails/pages/TokenDetails/TokenDetailsHeader.tsx 205L
        justifyContent: 'flex-start',
        gap: '$3',
      }}
      {...rest}
    >
      {Children.toArray(children)}
    </XStack>
  );
}

RawActions.More = ActionMore;
RawActions.Buy = ActionBuy;
RawActions.Send = ActionSend;
RawActions.Receive = ActionReceive;
RawActions.Swap = ActionSwap;
RawActions.Bridge = ActionBridge;
RawActions.Perp = ActionPerp;
RawActions.Earn = ActionEarn;
RawActions.Staking = ActionStaking;

export { RawActions, ActionItem };
