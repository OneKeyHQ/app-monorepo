import {
  Button,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

interface IPerpTradingSetupProps {
  onConnect: () => void;
}

function PerpTradingSetup({ onConnect }: IPerpTradingSetupProps) {
  return (
    <YStack
      flex={1}
      bg="$bg"
      justifyContent="center"
      alignItems="center"
      p="$6"
      space="$4"
    >
      {/* Setup Icon */}
      <Icon name="WalletOutline" size="$16" color="$iconSubdued" />

      {/* Setup Content */}
      <YStack alignItems="center" space="$3" maxWidth={320}>
        <SizableText size="$headingMd" fontWeight="600" textAlign="center">
          Connect Wallet to Trade
        </SizableText>

        <SizableText size="$bodySm" color="$textSubdued" textAlign="center">
          Connect your wallet to access perpetual trading features including:
        </SizableText>

        {/* Features List */}
        <YStack space="$2" alignSelf="stretch">
          {[
            'Open long and short positions',
            'Leverage up to 100x',
            'Real-time portfolio tracking',
            'Advanced order types',
          ].map((feature, index) => (
            <XStack key={index} alignItems="center" space="$2">
              <Icon name="XCircleOutline" size="$4" color="$iconSuccess" />
              <SizableText size="$bodySm" color="$textSecondary">
                {feature}
              </SizableText>
            </XStack>
          ))}
        </YStack>
      </YStack>

      {/* Action Buttons */}
      <YStack space="$3" alignSelf="stretch" maxWidth={320}>
        <Button size="large" onPress={onConnect}>
          <SizableText fontWeight="600">Connect Wallet</SizableText>
        </Button>

        <Button size="medium" variant="secondary" disabled>
          <SizableText>Switch to Hyperliquid Network</SizableText>
        </Button>
      </YStack>

      {/* Disclaimer */}
      <YStack
        p="$4"
        bg="$yellow2"
        borderRadius="$4"
        maxWidth={320}
        alignSelf="stretch"
      >
        <SizableText size="$bodySm" color="$yellow11" textAlign="center">
          ⚠️ Trading perpetuals involves significant risk. Only trade with funds
          you can afford to lose.
        </SizableText>
      </YStack>
    </YStack>
  );
}

export { PerpTradingSetup };
