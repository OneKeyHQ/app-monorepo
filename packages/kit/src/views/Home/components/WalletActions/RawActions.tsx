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
  highlighted?: boolean;
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
  highlighted = false,
  onPress,
  disabled,
  ...rest
}: IActionItemsProps) {
  const visualDisabled = !!disabled;
  const effectiveDisabled = visualDisabled && !allowPressWhenDisabled;

  let iconColor: '$iconDisabled' | '$iconInverse' | '$icon' = '$icon';
  if (visualDisabled) iconColor = '$iconDisabled';
  else if (highlighted) iconColor = '$iconInverse';

  let textColor: '$textDisabled' | '$textInverse' | '$text' = '$text';
  if (visualDisabled) textColor = '$textDisabled';
  else if (highlighted) textColor = '$textInverse';

  if (showButtonStyle) {
    return (
      <Button
        testID="home-action-item-btn"
        icon={icon || undefined}
        variant={highlighted ? 'primary' : undefined}
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
        bg={highlighted ? '$bgPrimary' : '$bgStrong'}
        borderRadius="$4"
        pt="$2.5"
        pb="$1"
        px="$1"
        userSelect="none"
        hoverStyle={{
          bg: highlighted ? '$bgPrimaryHover' : '$bgStrongHover',
        }}
        pressStyle={{
          bg: highlighted ? '$bgPrimaryActive' : '$bgStrongActive',
        }}
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
            <Icon name={icon} size="$6" color={iconColor} />
          </Stack>
        ) : null}
        <SizableText
          my="$1"
          textAlign="center"
          size="$bodySm"
          color={textColor}
        >
          {label}
        </SizableText>
      </Stack>

      {/* Desktop: Pill button */}
      <Button
        testID="home-btn"
        variant={highlighted ? 'primary' : 'secondary'}
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
  iconOnly = false,
}: {
  renderItemsAsync: IActionListProps['renderItemsAsync'];
  testID?: string;
  // When true, render the icon-only trigger on both mobile and desktop. Used
  // by the collapsed Add-Money home action row, where the secondary menu
  // should not steal flex space from the primary CTA.
  iconOnly?: boolean;
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

  if (iconOnly) {
    return (
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
    );
  }

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
RawActions.Perp = ActionPerp;
RawActions.Earn = ActionEarn;
RawActions.Staking = ActionStaking;

export { RawActions, ActionItem };
