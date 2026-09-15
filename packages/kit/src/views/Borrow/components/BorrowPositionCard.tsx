import type { ReactElement } from 'react';

import { StyleSheet } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import {
  Badge,
  Button,
  Icon,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IBadgeType } from '@onekeyhq/components';
import { ANIMATE_ONLY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import { Token } from '@onekeyhq/kit/src/components/Token';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IBorrowApy,
  IBorrowToken,
  IEarnText,
} from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';

import { ApyTextV2 } from './BorrowTableList/ApyTextV2';

const ACCESSIBILITY_ACTIVATE = [{ name: 'activate' }] as const;

export type IBorrowPositionCardAction = {
  key: string;
  label: string;
  variant: 'primary' | 'secondary';
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

export type IBorrowPositionCardProps = {
  token: IBorrowToken;
  tokenAmount?: IEarnText;
  fiatValue?: IEarnText;
  apyDetail?: IBorrowApy;
  statusLabel: string;
  statusBadgeType: IBadgeType;
  platformBonusApy?: {
    title: IEarnText;
    logoURI?: string;
  };
  collateral?: React.ReactNode;
  actions: IBorrowPositionCardAction[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  testID?: string;
  actionsTestID?: string;
};

export function BorrowPositionCard({
  token,
  tokenAmount,
  fiatValue,
  apyDetail,
  statusLabel,
  statusBadgeType,
  platformBonusApy,
  collateral,
  actions,
  isExpanded = false,
  onToggleExpand,
  testID,
  actionsTestID,
}: IBorrowPositionCardProps): ReactElement {
  const reducedMotion = useReducedMotion();
  const isPressable = Boolean(onToggleExpand);
  const amountSize = tokenAmount?.size ?? '$bodyMd';
  const amountColor = tokenAmount?.color ?? '$textSubdued';

  // Keep button semantics on the asset row so the collateral switch is not
  // nested inside a button. Pointer presses stay on the card for pressStyle.
  // Let the row's children supply its label so both balances are announced.
  const disclosureProps = isPressable
    ? ({
        'aria-expanded': isExpanded,
        accessible: true,
        accessibilityRole: 'button',
        accessibilityState: { expanded: isExpanded },
        // TalkBack activation does not bubble to the card's onPress.
        accessibilityActions: ACCESSIBILITY_ACTIVATE,
        onAccessibilityAction: (event: {
          nativeEvent: { actionName: string };
        }) => {
          if (event.nativeEvent.actionName === 'activate') {
            onToggleExpand?.();
          }
        },
        // Show the focus ring for keyboard navigation, not pointer presses.
        focusVisibleStyle: {
          outlineColor: '$focusRing',
          outlineWidth: 2,
          outlineStyle: 'solid',
          outlineOffset: 1,
        },
        // role and tabIndex are DOM-only; React warns about them on native.
        ...(platformEnv.isRuntimeBrowser
          ? {
              role: 'button' as const,
              tabIndex: 0,
              onKeyDown: (event: {
                key: string;
                preventDefault: () => void;
              }) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onToggleExpand?.();
                }
              },
            }
          : {}),
      } as const)
    : {};

  return (
    <YStack gap="$2">
      <YStack
        testID={testID}
        cursor={isPressable ? 'pointer' : undefined}
        bg="$bgSubdued"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius="$3"
        borderCurve="continuous"
        p="$3"
        gap="$2"
        hoverStyle={isPressable ? { bg: '$bgHover' } : undefined}
        pressStyle={isPressable ? { bg: '$bgActive' } : undefined}
        onPress={onToggleExpand}
      >
        <XStack ai="center" jc="space-between" gap="$3">
          <XStack ai="center" gap="$2" flexShrink={1} minWidth={0}>
            <Badge badgeType={statusBadgeType} badgeSize="sm">
              {statusLabel}
            </Badge>
            {apyDetail ? <ApyTextV2 apyDetail={apyDetail} /> : null}
          </XStack>
          {collateral ? (
            <XStack ai="center" gap="$2.5" flexShrink={1} minWidth={0}>
              {collateral}
            </XStack>
          ) : null}
        </XStack>

        <XStack ai="center" gap="$3" py="$2" {...disclosureProps}>
          <Token size="lg" tokenImageUri={token.logoURI} />
          <YStack flex={1} minWidth={0} gap="$0.5">
            <SizableText size="$bodyLgMedium" numberOfLines={1}>
              {token.symbol}
            </SizableText>
            {platformBonusApy ? (
              <XStack ai="center" gap="$1">
                <EarnText
                  text={platformBonusApy.title}
                  size="$bodySmMedium"
                  color="$textSuccess"
                  numberOfLines={1}
                />
                {platformBonusApy.logoURI ? (
                  <Image
                    src={platformBonusApy.logoURI}
                    width="$3.5"
                    height="$3.5"
                  />
                ) : null}
              </XStack>
            ) : null}
          </YStack>
          <XStack ai="center" gap="$2" flexShrink={0}>
            <YStack ai="flex-end">
              {fiatValue ? (
                <EarnText
                  text={fiatValue}
                  size="$bodyLgMedium"
                  color="$text"
                  numberOfLines={1}
                />
              ) : null}
              {tokenAmount ? (
                <XStack ai="center" gap="$1">
                  <EarnText
                    text={tokenAmount}
                    size={amountSize}
                    color={amountColor}
                    numberOfLines={1}
                  />
                  <SizableText size={amountSize} color={amountColor}>
                    {token.symbol}
                  </SizableText>
                </XStack>
              ) : null}
            </YStack>
            {isPressable ? (
              <Stack
                transition={reducedMotion ? undefined : 'quick'}
                animateOnly={ANIMATE_ONLY_TRANSFORM}
                rotate={isExpanded ? '0deg' : '-90deg'}
              >
                <Icon
                  name="ChevronDownSmallOutline"
                  size="$5"
                  color="$iconSubdued"
                />
              </Stack>
            ) : null}
          </XStack>
        </XStack>
      </YStack>

      {isExpanded && actions.length ? (
        <XStack testID={actionsTestID} ai="center" gap="$4">
          {actions.map((action) => (
            <Button
              key={action.key}
              testID={action.testID}
              flex={1}
              size="large"
              variant={action.variant}
              disabled={action.disabled}
              onPress={action.onPress}
            >
              {action.label}
            </Button>
          ))}
        </XStack>
      ) : null}
    </YStack>
  );
}
