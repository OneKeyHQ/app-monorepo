import type { FC } from 'react';

import { Icon, SizableText, Stack } from '@onekeyhq/components';
import type { IColorTokens, IIconProps } from '@onekeyhq/components';

type IRiskIndicatorCardType = 'unknown' | 'safe' | 'danger' | 'info';

export interface IRiskIndicatorCardProps {
  type: IRiskIndicatorCardType;
  title: string;
  description: string;
}

const typeConfig: Record<
  IRiskIndicatorCardType,
  { iconName: IIconProps['name']; iconColor: IColorTokens }
> = {
  unknown: {
    iconName: 'QuestionmarkOutline',
    iconColor: '$iconSubdued',
  },
  safe: {
    iconName: 'CheckRadioSolid',
    iconColor: '$iconSuccess',
  },
  danger: {
    iconName: 'ShieldExclamationSolid',
    iconColor: '$iconCritical',
  },
  info: {
    iconName: 'Document1Outline',
    iconColor: '$icon',
  },
};

export const RiskIndicatorCard: FC<IRiskIndicatorCardProps> = ({
  type,
  title,
  description,
}) => {
  const config = typeConfig[type];

  return (
    <Stack
      borderRadius="$3"
      padding="$4"
      backgroundColor="$surface-default"
      borderWidth={1}
      borderColor="$border-subdued"
    >
      <Stack flexDirection="row" alignItems="center" space="$3">
        <Stack padding="$1">
          <Icon
            name={config.iconName}
            color={config.iconColor}
            size="$5" // Adjust size as needed
          />
        </Stack>
        <SizableText size="$bodyLgMedium">{title}</SizableText>
      </Stack>
      <SizableText size="$bodyMd" color="$text-subdued" paddingTop="$2">
        {description}
      </SizableText>
    </Stack>
  );
};
