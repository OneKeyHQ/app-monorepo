import { useEffect, useState } from 'react';

import { BigNumber } from 'bignumber.js';

import type { IXStackProps } from '@onekeyhq/components';
import {
  Badge,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

import type { Package } from '@revenuecat/purchases-js';

function PrimeSubscriptionPlanItem({
  selected,
  title,
  periodDuration,
  price,
  currency,
  ...rest
}: {
  selected?: boolean;
  title: string;
  periodDuration: 'P1Y' | 'P1M';
  price: number;
  currency: string;
} & IXStackProps) {
  let promoText = '';
  let pricePerMonth = price;
  if (periodDuration === 'P1Y') {
    const pricePerMonthBN = new BigNumber(price).div(12);
    pricePerMonth = pricePerMonthBN.toNumber();
    // const savePercent = new BigNumber(1)
    //   .minus(pricePerMonthBN.div(price))
    //   .multipliedBy(100)
    //   .toFixed(1);
    // promoText = `Save ${savePercent}%`;
    promoText = `Save 33%`;
  }
  return (
    <YStack
      pl="$5"
      pr="$4"
      py="$5"
      bg="$bg"
      borderWidth={2}
      borderColor={selected ? '$borderActive' : '$borderSubdued'}
      borderRadius="$3"
      borderCurve="continuous"
      userSelect="none"
      {...rest}
    >
      {promoText ? (
        <Badge position="absolute" top={-11} right="$4" bg="$bgInverse">
          <Badge.Text color="$textInverse">{promoText}</Badge.Text>
        </Badge>
      ) : null}
      <SizableText size="$headingXl" mr="$2">
        {title}
      </SizableText>

      <XStack flex={1} justifyContent="space-between" alignItems="center">
        <NumberSizeableText
          size="$headingXl"
          formatter="price"
          formatterOptions={{
            currency,
          }}
        >
          {price}
        </NumberSizeableText>

        <NumberSizeableText
          ml="$2"
          size="$bodyMd"
          color="$textSubdued"
          formatter="price"
          formatterOptions={{
            currency,
            tokenSymbol: '/month', // TODO i18n
          }}
        >
          {pricePerMonth}
        </NumberSizeableText>
      </XStack>
    </YStack>
  );
}

export function PrimeSubscriptionPlans({
  packages,
  onPackageSelected,
}: {
  packages: Package[] | undefined;
  onPackageSelected: (packageId: string) => void;
}) {
  const [selectedPackageId, setSelectedPackageId] = useState<
    string | undefined
  >(packages?.[0]?.identifier);

  useEffect(() => {
    if (selectedPackageId) {
      onPackageSelected(selectedPackageId);
    }
  }, [onPackageSelected, selectedPackageId]);

  return (
    <YStack
      gap="$2.5"
      $gtMd={{
        flexDirection: 'row',
      }}
    >
      {packages?.map((p) => {
        const selected = selectedPackageId === p.identifier;
        return (
          <PrimeSubscriptionPlanItem
            key={p.identifier}
            selected={selected}
            title={p.rcBillingProduct.title}
            periodDuration={
              p.rcBillingProduct?.normalPeriodDuration as unknown as any
            }
            price={p.rcBillingProduct.currentPrice.amountMicros / 1_000_000}
            onPress={() => {
              setSelectedPackageId(p.identifier);
            }}
            currency="$"
            $gtMd={{
              flex: 1,
            }}
          />
        );
      })}
    </YStack>
  );
}
