import {
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

export interface ITxnsWalletInfo {
  /** Positive (green) count, e.g. incoming wallets */
  buy: number;
  /** Negative (red) count, e.g. outgoing wallets */
  sell: number;
}

interface ITxnsProps {
  /**
   * Total transactions count (e.g. 53030 -> 53.03K)
   */
  transactions: number;
  /**
   * Wallet info object containing buy & sell counts.
   */
  walletInfo?: ITxnsWalletInfo;
}

/**
 * Render transactions statistics with a wallet info breakdown.
 *
 * Design reference:
 *   53.03K
 *   38.55K/39.64K
 *
 */
export function Txns({ transactions, walletInfo }: ITxnsProps) {
  return (
    <YStack gap="$0.5">
      {/* Total transactions */}
      <NumberSizeableText size="$bodyMd" formatter="marketCap">
        {transactions}
      </NumberSizeableText>

      {/* Wallet info breakdown */}
      {walletInfo ? (
        <XStack gap="$0.5">
          <NumberSizeableText
            size="$bodySm"
            color="$textSuccess"
            formatter="marketCap"
          >
            {walletInfo.buy}
          </NumberSizeableText>
          <SizableText size="$bodySm" color="$textSubdued">
            /
          </SizableText>
          <NumberSizeableText
            size="$bodySm"
            color="$textCritical"
            formatter="marketCap"
          >
            {walletInfo.sell}
          </NumberSizeableText>
        </XStack>
      ) : null}
    </YStack>
  );
}
