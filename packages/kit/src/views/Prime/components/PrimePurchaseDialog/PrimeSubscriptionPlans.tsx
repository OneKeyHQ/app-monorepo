import { useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IXStackProps } from '@onekeyhq/components';
import { Badge, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type {
  IPackage,
  ISubscriptionPeriod,
} from '../../hooks/usePrimePaymentTypes';

function PrimeSubscriptionPlanItem({
  selected,
  periodDuration,
  pricePerMonthString,
  pricePerYearString,
  ...rest
}: {
  selected?: boolean;
  periodDuration: 'P1Y' | 'P1M';
  pricePerMonthString: string;
  pricePerYearString: string;
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
      <SizableText size="$headingXl" mr="$2">
        Prime {title}
      </SizableText>

      <XStack flex={1} justifyContent="space-between" alignItems="center">
        <SizableText size="$headingXl">
          {isYearly ? pricePerYearString : pricePerMonthString}
        </SizableText>

        <SizableText ml="$2" size="$bodyMd" color="$textSubdued">
          {`${pricePerMonthString}/${intl.formatMessage({
            id: ETranslations.prime_per_month,
          })}`}
        </SizableText>
      </XStack>
    </YStack>
  );
}

export function PrimeSubscriptionPlans({
  packages,
  onSubscriptionPeriodSelected,
}: {
  packages?: IPackage[];
  onSubscriptionPeriodSelected: (
    subscriptionPeriod: ISubscriptionPeriod,
  ) => void;
}) {
  const [selectedSubscriptionPeriod, setSelectedSubscriptionPeriod] =
    useState<ISubscriptionPeriod>('P1Y');

  useEffect(() => {
    if (selectedSubscriptionPeriod) {
      onSubscriptionPeriodSelected(selectedSubscriptionPeriod);
    }
  }, [onSubscriptionPeriodSelected, selectedSubscriptionPeriod]);

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
            pricePerYearString={p.pricePerYearString}
            onPress={() => {
              setSelectedSubscriptionPeriod(p.subscriptionPeriod);
            }}
          />
        );
      })}
    </YStack>
  );
}
