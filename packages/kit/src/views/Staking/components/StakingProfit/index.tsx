import {
  Badge,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';

const ProfitContentItem = ({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) => (
  <YStack $md={{ width: '50%' }} $gtMd={{ width: '25%' }} mb="$2">
    <SizableText size="$bodyMd" color="$textSubdued">
      {title}
    </SizableText>
    <SizableText size="$bodyLgMedium" color="$textInteractive">
      {Number(value).toFixed(2)}%
    </SizableText>
  </YStack>
);

export const StakingProfit = ({
  apr,
  tokenImageUrl,
  tokenSymbol,
}: {
  apr: number;
  tokenImageUrl?: string;
  tokenSymbol: string;
}) => (
  <YStack mt="$12">
    <SizableText size="$headingLg">Profit</SizableText>
    <XStack mt="$5" space="$1">
      <Token size="sm" tokenImageUri={tokenImageUrl} />
      <SizableText size="$bodyLgMedium">
        {tokenSymbol.toUpperCase()}
      </SizableText>
      <Badge badgeType="default" badgeSize="sm">
        Updated daily
      </Badge>
    </XStack>
    <Stack mt="$5" flexDirection="row" flexWrap="wrap">
      <ProfitContentItem value={apr / 365} title="Daily" />
      <ProfitContentItem value={apr / 52} title="Weekly" />
      <ProfitContentItem value={apr / 12} title="Monthly" />
      <ProfitContentItem value={apr} title="Annually" />
    </Stack>
  </YStack>
);
