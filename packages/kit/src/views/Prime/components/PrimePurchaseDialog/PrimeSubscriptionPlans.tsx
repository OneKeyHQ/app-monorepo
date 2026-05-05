import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IXStackProps } from '@onekeyhq/components';
import {
  Badge,
  SizableText,
  Skeleton,
  Stack,
  Theme,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type {
  IPackage,
  ISubscriptionPeriod,
} from '../../hooks/usePrimePaymentTypes';

const AUTO_RENEW_TEXT_IDS = {
  trial: {
    month: ETranslations.prime_subscription_auto_renew_price_after_trial_month,
    year: ETranslations.prime_subscription_auto_renew_price_after_trial_year,
  },
  normal: {
    month: ETranslations.prime_subscription_auto_renew_price_month,
    year: ETranslations.prime_subscription_auto_renew_price_year,
  },
} as const;

function PrimeSubscriptionPlanItem({
  selected,
  periodDuration,
  pricePerMonthString,
  priceTotalPerYearString,
  ...rest
}: {
  selected?: boolean;
  periodDuration: 'P1Y' | 'P1M';
  pricePerMonthString: string;
  priceTotalPerYearString: string;
} & IXStackProps) {
  const isYearly = periodDuration === 'P1Y';
  const intl = useIntl();
  const title =
    periodDuration === 'P1Y'
      ? intl.formatMessage({ id: ETranslations.prime_yearly })
      : intl.formatMessage({ id: ETranslations.prime_monthly });

  return (
    <YStack
      bg="$bg"
      px="$3.5"
      py="$3"
      borderWidth={2}
      borderColor={selected ? '$borderActive' : '$borderSubdued'}
      borderRadius="$3"
      borderCurve="continuous"
      userSelect="none"
      {...rest}
    >
      {isYearly ? (
        <Badge position="absolute" top={-11} right="$4" bg="$bgInverse">
          <Badge.Text color="$textInverse">
            {intl.formatMessage(
              {
                id: ETranslations.prime_save_discount,
              },
              {
                'discount': '33',
              },
            )}
          </Badge.Text>
        </Badge>
      ) : null}
      <SizableText size="$bodyMdMedium" color="$textSubdued">
        {title}
      </SizableText>
      <SizableText
        size="$headingLg"
        mt="$0.5"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {intl.formatMessage(
          {
            id: ETranslations.prime_prime_price_per_month,
          },
          {
            price: pricePerMonthString,
          },
        )}
      </SizableText>
      <SizableText size="$bodySm" color="$textSubdued">
        {intl.formatMessage(
          {
            id: ETranslations.prime_prime_price_per_year,
          },
          {
            price: priceTotalPerYearString,
          },
        )}
      </SizableText>
    </YStack>
  );
}

export function PrimeSubscriptionPlans({
  packages,
  selectedSubscriptionPeriod,
  onSubscriptionPeriodSelected,
}: {
  packages?: IPackage[];
  selectedSubscriptionPeriod: ISubscriptionPeriod;
  onSubscriptionPeriodSelected: (
    subscriptionPeriod: ISubscriptionPeriod,
  ) => void;
}) {
  const intl = useIntl();

  const autoRenewText = useMemo(() => {
    const selectedPackage = packages?.find(
      (p) => p.subscriptionPeriod === selectedSubscriptionPeriod,
    );
    const isMonthly = selectedPackage?.subscriptionPeriod === 'P1M';
    const hasFreeTrial = Boolean(selectedPackage?.freeTrial);
    const price = isMonthly
      ? selectedPackage?.pricePerMonthString
      : selectedPackage?.pricePerYearString;
    const id =
      AUTO_RENEW_TEXT_IDS[hasFreeTrial ? 'trial' : 'normal'][
        isMonthly ? 'month' : 'year'
      ];
    return (
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({ id }, { price })}
      </SizableText>
    );
  }, [intl, packages, selectedSubscriptionPeriod]);

  if (!packages?.length) {
    return (
      <Theme name="dark">
        <XStack gap="$2.5">
          <Skeleton flex={1} height={100} />
          <Skeleton flex={1} height={100} />
        </XStack>
      </Theme>
    );
  }

  return (
    <YStack>
      <XStack gap="$2.5">
        {packages?.map((p) => {
          const selected = selectedSubscriptionPeriod === p.subscriptionPeriod;
          return (
            <PrimeSubscriptionPlanItem
              key={p.subscriptionPeriod}
              flex={1}
              selected={selected}
              periodDuration={p.subscriptionPeriod}
              pricePerMonthString={p.pricePerMonthString}
              priceTotalPerYearString={p.priceTotalPerYearString}
              onPress={() => {
                onSubscriptionPeriodSelected(p.subscriptionPeriod);
              }}
            />
          );
        })}
      </XStack>
      <Stack mt="$1.5">{autoRenewText}</Stack>
    </YStack>
  );
}
