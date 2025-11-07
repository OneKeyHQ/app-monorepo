import { YStack } from '@onekeyhq/components';

import { Card } from './RewardCard';

// Demo component showing how to use the RewardCard components

export function RewardCardDemo() {
  return (
    <YStack gap="$5" p="$5">
      {/* Hardware sale reward card */}
      <Card.Container>
        <Card.Header
          icon="OnekeyLiteOutline"
          title="Hardware sale reward"
          onPress={() => console.log('Navigate to hardware sales')}
        />
        <Card.Description description="From who bought hardware with your code" />

        <Card.Item label="Monthly sales" value="$4,501.42" />

        <Card.Divider />

        <Card.Item
          label="Undistributed"
          showInfoIcon
          onInfoPress={() => console.log('Show undistributed info')}
          value={
            <Card.TokenValue
              tokenImageUri="https://example.com/usdc.png"
              amount="0.52"
              symbol="USDC"
            />
          }
        />

        <Card.Item
          label="Pending"
          showInfoIcon
          onInfoPress={() => console.log('Show pending info')}
          value={
            <Card.TokenValue
              tokenImageUri="https://example.com/usdc.png"
              amount="0.52"
              symbol="USDC"
            />
          }
        />
      </Card.Container>

      {/* On-chain reward card */}
      <Card.Container>
        <Card.Header
          icon="CoinsOutline"
          title="On-chain reward"
          onPress={() => console.log('Navigate to on-chain rewards')}
        />
        <Card.Description description="From wallets linked to your code" />

        <Card.Item
          label="DeFi"
          showInfoIcon
          onInfoPress={() => console.log('Show DeFi info')}
          value={
            <Card.TokenValue
              tokenImageUri="https://example.com/usdc.png"
              amount="0.52"
              symbol="USDC"
            />
          }
        />

        <Card.Item
          label="Perp"
          value={
            <Card.TokenValue
              tokenImageUri="https://example.com/usdc.png"
              amount="0.52"
              symbol="USDC"
            />
          }
        />
      </Card.Container>
    </YStack>
  );
}
