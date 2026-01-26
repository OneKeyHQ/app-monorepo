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
  bottomNote?: ReactNode;
}

export function ReferralBenefitsList({
  title,
  subtitle,
  benefits,
  bottomNote,
}: IReferralBenefitsListProps) {
  return (
    <YStack gap="$6" $gtMd={{ minWidth: 480 }}>
      {/* Title and Subtitle Container */}
      <YStack gap="$1">
        <SizableText size="$heading2xl">{title}</SizableText>

        {subtitle ? (
          <SizableText size="$bodyLg" color="$textSubdued">
            {subtitle}
          </SizableText>
        ) : null}
      </YStack>

      {/* Benefits List */}
      <YStack gap="$4">
        {benefits.map((benefit, index) => (
          <XStack
            key={index}
            gap="$3"
            alignItems={benefit.note ? 'flex-start' : 'center'}
          >
            <Icon name={benefit.icon} color="$iconSubdued" size="$6" />
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
        {bottomNote ? (
          <SizableText size="$bodySm" color="$textSubdued">
            {bottomNote}
          </SizableText>
        ) : null}
      </YStack>
    </YStack>
  );
}
