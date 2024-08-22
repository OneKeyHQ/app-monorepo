import {
  NumberSizeableText,
  Page,
  Progress,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

function StakedValue({
  value = 0,
  stakedNumber = 0,
  avaliableNumber = 0,
}: {
  value: number;
  stakedNumber: number;
  avaliableNumber: number;
}) {
  const totalNumber = stakedNumber + avaliableNumber;
  return (
    <YStack gap="$6" pb="$8">
      <YStack gap="$2">
        <SizableText size="$headingLg">Staked value</SizableText>
        <NumberSizeableText
          size="$heading4xl"
          color={value === 0 ? '$textDisabled' : '$text'}
          formatter="value"
          formatterOptions={{ currency: '$' }}
        >
          {value}
        </NumberSizeableText>
      </YStack>
      <YStack gap="$1.5">
        <YStack my="$1.5">
          <Progress
            colors={['$bgSuccessStrong', '$bgInverse']}
            size="medium"
            gap={2}
            value={totalNumber === 0 ? 0 : (stakedNumber / totalNumber) * 100}
          />
        </YStack>
        <XStack justifyContent="space-between">
          <YStack gap="$0.5">
            <SizableText size="$bodyMd" color="$textSubdued">
              Staked
            </SizableText>
            <NumberSizeableText
              size="$bodyLgMedium"
              formatter="price"
              formatterOptions={{ tokenSymbol: 'ETH' }}
            >
              {stakedNumber}
            </NumberSizeableText>
          </YStack>
          <YStack gap="$0.5">
            <SizableText size="$bodyMd" color="$textSuccess" textAlign="right">
              Available
            </SizableText>
            <NumberSizeableText
              size="$bodyLgMedium"
              formatter="price"
              formatterOptions={{ tokenSymbol: 'ETH' }}
            >
              {avaliableNumber}
            </NumberSizeableText>
          </YStack>
        </XStack>
      </YStack>
    </YStack>
  );
}

export default function EarnTokenDetail() {
  return (
    <Page scrollEnabled>
      <Page.Header title="Earn ETH" />
      <Page.Body>
        <YStack px="$5">
          <StakedValue value={100} stakedNumber={1} avaliableNumber={3} />
        </YStack>
      </Page.Body>
    </Page>
  );
}
