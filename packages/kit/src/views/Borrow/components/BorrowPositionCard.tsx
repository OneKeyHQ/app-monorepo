import { StyleSheet } from 'react-native';

import {
  Badge,
  Button,
  Image,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IBadgeType } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IBorrowApy,
  IBorrowToken,
  IEarnText,
} from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';

import { ApyTextV2 } from './BorrowTableList/ApyTextV2';

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
  expandLabel?: string;
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
  expandLabel,
  testID,
  actionsTestID,
}: IBorrowPositionCardProps) {
  const isPressable = Boolean(onToggleExpand);
  const amountSize = tokenAmount?.size ?? '$bodyMd';
  const amountColor = tokenAmount?.color ?? '$textSubdued';

  // The whole card is the pointer target, but it can't carry the button role:
  // the collateral Switch is a focusable role="switch" and ARIA forbids
  // interactive descendants inside role="button". The asset row below has no
  // interactive children, so it carries the semantics and the keyboard entry
  // point instead. It deliberately takes no onPress — that would make tamagui
  // attach press handling and claim the native touch responder, which would
  // stop the card's own pressStyle from ever firing.
  const disclosureProps = isPressable
    ? ({
        role: 'button',
        'aria-expanded': isExpanded,
        'aria-label': expandLabel,
        tabIndex: 0,
        accessible: true,
        accessibilityRole: 'button',
        accessibilityLabel: expandLabel,
        accessibilityState: { expanded: isExpanded },
        onAccessibilityTap: onToggleExpand,
        focusStyle: {
          outlineColor: '$focusRing',
          outlineWidth: 2,
          outlineStyle: 'solid',
          outlineOffset: 1,
        },
        ...(platformEnv.isRuntimeBrowser
          ? {
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
        bg="$bgApp"
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
            <SizableText size="$bodyMdMedium" numberOfLines={1}>
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
          <YStack ai="flex-end" flexShrink={0}>
            {fiatValue ? (
              <EarnText
                text={fiatValue}
                size="$bodyLg"
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
