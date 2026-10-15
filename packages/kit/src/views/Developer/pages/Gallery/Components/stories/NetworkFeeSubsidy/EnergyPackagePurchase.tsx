import { useRef, useState } from 'react';

import {
  Button,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { energyPackageOffers } from './energyPackageDemo';

export function EnergyPackagePurchase({
  onComplete,
}: {
  onComplete: (units: number) => Promise<void>;
}) {
  const [selectedUnits, setSelectedUnits] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const submitted = useRef(false);
  const selected =
    energyPackageOffers.find((offer) => offer.units === selectedUnits) ??
    energyPackageOffers[0];

  return (
    <YStack gap="$5" testID="energy-package-purchase">
      <SizableText size="$bodyMd" color="$textSubdued">
        适用于 TRON 网络 USDT 转账，每次消耗 1–2 份。
      </SizableText>
      <YStack gap="$3">
        {energyPackageOffers.map((offer) => (
          <Button
            key={offer.units}
            testID={`energy-package-offer-${offer.units}`}
            variant="secondary"
            height="auto"
            p="$4"
            borderRadius="$4"
            borderWidth={1}
            borderColor={
              selectedUnits === offer.units ? '$borderActive' : '$borderSubdued'
            }
            childrenAsText={false}
            disabled={submitting}
            accessibilityLabel={`${offer.units} 份，演示价格 ${offer.price}`}
            accessibilityState={{ selected: selectedUnits === offer.units }}
            onPress={() => setSelectedUnits(offer.units)}
          >
            <XStack flex={1} alignItems="center" gap="$3">
              <YStack flex={1} gap="$1">
                <SizableText size="$headingLg">{offer.units} 份</SizableText>
                <SizableText size="$bodySm" color="$textSubdued">
                  购买后 30 天有效
                </SizableText>
              </YStack>
              <SizableText size="$headingMd">{offer.price}</SizableText>
              <Icon
                name={
                  selectedUnits === offer.units
                    ? 'CheckRadioSolid'
                    : 'CirclePlaceholderOnOutline'
                }
                size="$5"
                color={
                  selectedUnits === offer.units ? '$iconActive' : '$iconSubdued'
                }
              />
            </XStack>
          </Button>
        ))}
      </YStack>
      <YStack gap="$2">
        <SizableText size="$bodySm" color="$textSubdued">
          购买额度绑定当前 OneKey ID，独立于 Prime
          月度赠送额度，不随赠送额度一起重置。
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          演示模式：套餐价格和 30 天有效期仅用于预览，不会扣款或发起交易。
        </SizableText>
      </YStack>
      <Button
        testID="energy-package-confirm-purchase"
        size="large"
        variant="primary"
        loading={submitting}
        disabled={submitting}
        onPress={async () => {
          if (submitted.current) return;
          submitted.current = true;
          setSubmitting(true);
          try {
            await onComplete(selected.units);
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {`模拟购买 · ${selected.price}`}
      </Button>
    </YStack>
  );
}
