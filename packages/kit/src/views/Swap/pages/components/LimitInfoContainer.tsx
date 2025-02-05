import { Select, SizableText, XStack, YStack } from '@onekeyhq/components';

import LimitRateInput from '../../components/LimitRateInput';

const LimitInfoContainer = () => {
  console.log('LimitInfoContainer');
  return (
    <XStack gap="$2">
      <YStack gap="$2">
        <XStack justifyContent="space-between">
          <SizableText> Limit price</SizableText>
          <SizableText> market</SizableText>
        </XStack>
        <LimitRateInput currency="USDC/ETH" />
      </YStack>
      <YStack gap="$2" flex={1}>
        <SizableText> Expiry</SizableText>
        <Select title="Expiry" items={[{ label: '1 hour', value: '1 hour' }]} />
      </YStack>
    </XStack>
  );
};

export default LimitInfoContainer;
