import { useEffect, useState } from 'react';

import type { IXStackProps } from '@onekeyhq/components';
import { Badge, SizableText, XStack, YStack } from '@onekeyhq/components';

import type { IPackage, IPackageId } from '../../hooks/usePrimePaymentTypes';

function PrimeSubscriptionPlanItem({
  selected,
  title,
  periodDuration,
  pricePerMonthString,
  pricePerYearString,
  ...rest
}: {
  selected?: boolean;
  title: string;
  periodDuration: 'P1Y' | 'P1M';
  pricePerMonthString: string;
  pricePerYearString: string;
} & IXStackProps) {
  let promoText = '';
  // let pricePerMonth = price;
  if (periodDuration === 'P1Y') {
    // const pricePerMonthBN = new BigNumber(price).div(12);
    // pricePerMonth = pricePerMonthBN.toNumber();
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
        <SizableText size="$headingXl">{pricePerYearString}</SizableText>

        <SizableText ml="$2" size="$bodyMd" color="$textSubdued">
          {`${pricePerMonthString}/month`}
        </SizableText>
      </XStack>
    </YStack>
  );
}

export function PrimeSubscriptionPlans({
  packages,
  onPackageSelected,
}: {
  packages?: IPackage[];
  onPackageSelected: (packageId: IPackageId) => void;
}) {
  const [selectedPackageId, setSelectedPackageId] = useState<IPackageId>('P1Y');

  useEffect(() => {
    if (selectedPackageId) {
      onPackageSelected(selectedPackageId);
    }
  }, [onPackageSelected, selectedPackageId]);

  return (
    <YStack gap="$2.5">
      {packages?.map((p) => {
        const selected = selectedPackageId === p.packageId;
        return (
          <PrimeSubscriptionPlanItem
            key={p.packageId}
            selected={selected}
            title={p.packageId === 'P1Y' ? 'Prime Yearly' : 'Prime Monthly'}
            periodDuration={p.packageId}
            pricePerMonthString={p.pricePerMonthString}
            pricePerYearString={p.pricePerYearString}
            onPress={() => {
              setSelectedPackageId(p.packageId);
            }}
          />
        );
      })}
    </YStack>
  );
}
