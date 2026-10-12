import {
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { Token } from '@onekeyhq/kit/src/components/Token';

/**
 * One claimable reward on the Rewards tab (figma 30490-21537): the token,
 * the amount with where it came from under it, the fiat on the right and
 * the row's action — Claim for a reward the server attached a claim to.
 */
export function ClaimableRewardRow({
  networkId,
  logoURI,
  title,
  subtitle,
  fiatValue,
  action,
}: {
  networkId: string;
  logoURI?: string;
  /** the amount line, "2.40 USDC" */
  title: React.ReactNode;
  /** the vault or market the reward came from */
  subtitle?: React.ReactNode;
  /** nothing when the server has not priced the reward */
  fiatValue?: string | number;
  action?: React.ReactNode;
}) {
  const currencyInfo = useCurrency();
  return (
    <XStack minHeight={44} ai="center" jc="space-between" gap="$3">
      <XStack ai="center" gap="$2.5" flex={1} minWidth={0}>
        <Token
          size="md"
          tokenImageUri={logoURI}
          showNetworkIcon
          networkId={networkId}
        />
        <YStack flex={1} minWidth={0} gap="$0.5">
          {typeof title === 'string' ? (
            <SizableText size="$bodyMdMedium" numberOfLines={1}>
              {title}
            </SizableText>
          ) : (
            title
          )}
          {typeof subtitle === 'string' ? (
            <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
              {subtitle}
            </SizableText>
          ) : (
            subtitle
          )}
        </YStack>
      </XStack>
      <XStack ai="center" gap="$2" flexShrink={0}>
        {fiatValue !== undefined && fiatValue !== '' ? (
          <NumberSizeableText
            size="$bodyMd"
            color="$textSubdued"
            formatter="value"
            formatterOptions={{ currency: currencyInfo.symbol }}
            numberOfLines={1}
          >
            {fiatValue}
          </NumberSizeableText>
        ) : null}
        {action}
      </XStack>
    </XStack>
  );
}
