import type { ReactNode } from 'react';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import type { IIconProps } from '@onekeyhq/components';

interface IBenefitItem {
  icon: IIconProps['name'];
  text: ReactNode;
  note?: ReactNode;
}

interface IReferralBenefitsListProps {
  title: ReactNode;
  subtitle: ReactNode;
  benefits: IBenefitItem[];
}

export function ReferralBenefitsList({
  title,
  subtitle,
  benefits,
}: IReferralBenefitsListProps) {
  return (
    <YStack gap="$6">
      {/* Title and Subtitle Container */}
      <YStack gap="$1">
        <SizableText size="$heading2xl">{title}</SizableText>
        <SizableText size="$bodyLg" color="$textSubdued">
          {subtitle}
        </SizableText>
      </YStack>

      {/* Benefits List */}
      <YStack gap="$4">
        {benefits.map((benefit, index) => (
          <XStack
            key={index}
            gap="$3"
            alignItems={benefit.note ? 'flex-start' : 'center'}
          >
            <Icon name={benefit.icon} size="$6" />
            {benefit.note ? (
              <YStack flex={1} gap="$1">
                <SizableText size="$bodyLgMedium">{benefit.text}</SizableText>
                <SizableText size="$bodySm" color="$textSubdued">
                  {benefit.note}
                </SizableText>
              </YStack>
            ) : (
              <SizableText size="$bodyLgMedium" flex={1}>
                {benefit.text}
              </SizableText>
            )}
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}
