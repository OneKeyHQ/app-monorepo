import { StyleSheet } from 'react-native';

import {
  Badge,
  Button,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IBadgeType } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
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
  testID?: string;
  actionsTestID?: string;
};

/**
 * The card body is the expand trigger, so any control inside it that carries
 * its own press semantics — the collateral Switch, the APY detail popover —
 * has to keep its tap to itself. Native stops here on its own because the
 * inner control wins the responder negotiation; the web DOM still bubbles the
 * click up to the card, which is what this cancels.
 */
function PressIsolate({
  children,
  testID,
}: {
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <Stack
      testID={testID}
      flexShrink={0}
      onPress={(event) => {
        event.stopPropagation();
      }}
    >
      {children}
    </Stack>
  );
}

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
}: IBorrowPositionCardProps) {
  const isPressable = Boolean(onToggleExpand);

  return (
    <YStack gap="$2">
      <YStack
        testID={testID}
        role={isPressable ? 'button' : undefined}
        aria-expanded={isPressable ? isExpanded : undefined}
        focusable={isPressable}
        cursor={isPressable ? 'pointer' : undefined}
        userSelect="none"
        bg="$bgApp"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius="$3"
        borderCurve="continuous"
        p="$3"
        gap="$2"
        hoverStyle={isPressable ? { bg: '$bgHover' } : undefined}
        pressStyle={isPressable ? { bg: '$bgActive' } : undefined}
        focusVisibleStyle={{
          outlineColor: '$focusRing',
          outlineWidth: 2,
          outlineStyle: 'solid',
          outlineOffset: 1,
        }}
        onPress={onToggleExpand}
      >
        <XStack ai="center" jc="space-between" gap="$3">
          <XStack ai="center" gap="$2" flexShrink={1} minWidth={0}>
            <Badge badgeType={statusBadgeType} badgeSize="sm">
              {statusLabel}
            </Badge>
            {apyDetail ? (
              <PressIsolate testID={testID ? `${testID}-apy` : undefined}>
                <ApyTextV2 apyDetail={apyDetail} />
              </PressIsolate>
            ) : null}
          </XStack>
          {collateral ? (
            <PressIsolate testID={testID ? `${testID}-collateral` : undefined}>
              <XStack ai="center" gap="$2.5">
                {collateral}
              </XStack>
            </PressIsolate>
          ) : null}
        </XStack>

        <XStack ai="center" gap="$3" py="$2">
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
                  size="$bodyMd"
                  color="$textSubdued"
                  numberOfLines={1}
                />
                <SizableText size="$bodyMd" color="$textSubdued">
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
