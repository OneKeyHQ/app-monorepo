import type { FC } from 'react';

import { SizableText, Stack } from '@onekeyhq/components';

import { RiskIndicatorIcon } from './RiskIndicatorIcon';
import { useRiskIndicator } from './useRiskIndicator';

import type { IRiskIndicatorType } from './useRiskIndicator';

export interface IRiskIndicatorCardProps {
  type: IRiskIndicatorType;
  title: string;
  description: string;
}

export const RiskIndicatorCard: FC<IRiskIndicatorCardProps> = ({
  type,
  title,
  description,
}) => {
  const { titleColor } = useRiskIndicator(type);

  return (
    <Stack
      borderRadius="$3"
      padding="$4"
      backgroundColor="$surface-default"
      borderWidth={1}
      borderColor="$border-subdued"
      maxWidth={320}
    >
      <Stack
        flexDirection="row"
        alignItems="center"
        gap="$3"
        paddingBottom="$2"
        marginBottom="$3"
        bg="$bgSubdued"
        borderBottomWidth={1}
        borderColor="$border-subdued"
      >
        <RiskIndicatorIcon type={type} />
        <SizableText size="$bodyLgMedium" color={titleColor}>
          {title}
        </SizableText>
      </Stack>
      <SizableText size="$bodyMd" color="$text-subdued" paddingTop="$2">
        {description}
      </SizableText>
    </Stack>
  );
};
