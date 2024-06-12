import { useIntl } from 'react-intl';

import {
  Badge,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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
}) => {
  const intl = useIntl();
  return (
    <YStack mt="$12">
      <SizableText size="$headingLg">
        {intl.formatMessage({ id: ETranslations.global_profit })}
      </SizableText>
      <XStack mt="$5" space="$1">
        <Token size="sm" tokenImageUri={tokenImageUrl} />
        <SizableText size="$bodyLgMedium">
          {tokenSymbol.toUpperCase()}
        </SizableText>
        <Badge badgeType="default" badgeSize="sm">
          {intl.formatMessage({ id: ETranslations.earn_updated_daily })}
        </Badge>
      </XStack>
      <Stack mt="$5" flexDirection="row" flexWrap="wrap">
        <ProfitContentItem
          value={apr / 365}
          title={intl.formatMessage({ id: ETranslations.earn_daily })}
        />
        <ProfitContentItem
          value={apr / 52}
          title={intl.formatMessage({ id: ETranslations.earn_weekly })}
        />
        <ProfitContentItem
          value={apr / 12}
          title={intl.formatMessage({ id: ETranslations.earn_monthly })}
        />
        <ProfitContentItem
          value={apr}
          title={intl.formatMessage({ id: ETranslations.earn_annually })}
        />
      </Stack>
    </YStack>
  );
};
