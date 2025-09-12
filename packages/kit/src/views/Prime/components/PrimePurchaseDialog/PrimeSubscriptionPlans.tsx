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
      pl="$5"
      pr="$4"
      py="$5"
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
      <SizableText size="$headingLg" mr="$2">
        {title}
      </SizableText>

      <XStack flex={1} justifyContent="space-between" alignItems="center">
        <SizableText size="$headingLg">
          {intl.formatMessage(
            {
              id: ETranslations.prime_prime_price_per_month,
            },
            {
              price: pricePerMonthString,
            },
          )}
        </SizableText>

        <SizableText ml="$2" size="$bodyMd" color="$textSubdued">
          {intl.formatMessage(
            {
              id: ETranslations.prime_prime_price_per_year,
            },
            {
              price: priceTotalPerYearString,
            },
          )}
        </SizableText>
      </XStack>
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
    let text = intl.formatMessage(
      {
        id: ETranslations.prime_subscription_auto_renew_price_year,
      },
      {
        price: selectedPackage?.pricePerYearString,
      },
    );
    if (isMonthly) {
      text = intl.formatMessage(
        {
          id: ETranslations.prime_subscription_auto_renew_price_month,
        },
        {
          price: selectedPackage?.pricePerMonthString,
        },
      );
    }
    return (
      <SizableText
        size="$bodyMd"
        // textAlign={gtMd ? 'left' : 'center'}
        // alignSelf={gtMd ? 'flex-start' : 'center'}
      >
        {text}
      </SizableText>
    );
  }, [intl, packages, selectedSubscriptionPeriod]);

  if (!packages?.length) {
    return (
      <Theme name="dark">
        <YStack gap="$2.5">
          <Skeleton width="100%" height={100} />
          <Skeleton width="100%" height={100} />
        </YStack>
      </Theme>
    );
  }

  return (
    <YStack gap="$2.5">
      {packages?.map((p) => {
        const selected = selectedSubscriptionPeriod === p.subscriptionPeriod;
        return (
          <PrimeSubscriptionPlanItem
            key={p.subscriptionPeriod}
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
      <Stack>{autoRenewText}</Stack>
    </YStack>
  );
}
