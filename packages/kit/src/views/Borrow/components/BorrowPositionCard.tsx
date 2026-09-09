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
  apyLabel: string;
  platformBonusApy?: {
    title: IEarnText;
    logoURI?: string;
  };
  collateral?: React.ReactNode;
  actions: IBorrowPositionCardAction[];
  testID?: string;
};

export function BorrowPositionCard({
  token,
  tokenAmount,
  fiatValue,
  apyDetail,
  statusLabel,
  statusBadgeType,
  apyLabel,
  platformBonusApy,
  collateral,
  actions,
  testID,
}: IBorrowPositionCardProps) {
  const amountSize = tokenAmount?.size ?? '$bodyMdMedium';
  const amountColor = tokenAmount?.color ?? '$text';

  return (
    <YStack
      testID={testID}
      bg="$bgSubdued"
      borderRadius="$3"
      borderCurve="continuous"
      p="$4"
      gap="$3"
    >
      <XStack ai="flex-start" gap="$3">
        <Token size="md" tokenImageUri={token.logoURI} />
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
        <YStack ai="flex-end" gap="$0.5" flexShrink={0}>
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
          {fiatValue ? (
            <EarnText
              text={fiatValue}
              size="$bodySm"
              color="$textSubdued"
              numberOfLines={1}
            />
          ) : null}
        </YStack>
      </XStack>

      <XStack ai="center" gap="$2" flexWrap="wrap">
        <Badge badgeType={statusBadgeType} badgeSize="sm">
          {statusLabel}
        </Badge>
        {apyDetail ? (
          <XStack ai="center" gap="$1">
            <SizableText size="$bodySm" color="$textSubdued">
              {apyLabel}
            </SizableText>
            <ApyTextV2 apyDetail={apyDetail} />
          </XStack>
        ) : null}
      </XStack>

      <XStack ai="center" gap="$3">
        {collateral ? (
          <XStack ai="center" gap="$2" flexShrink={0}>
            {collateral}
          </XStack>
        ) : null}
        <XStack flex={1} gap="$2" jc="flex-end">
          {actions.map((action) => (
            <Button
              key={action.key}
              testID={action.testID}
              flex={1}
              size="small"
              variant="secondary"
              disabled={action.disabled}
              onPress={action.onPress}
            >
              {action.label}
            </Button>
          ))}
        </XStack>
      </XStack>
    </YStack>
  );
}
