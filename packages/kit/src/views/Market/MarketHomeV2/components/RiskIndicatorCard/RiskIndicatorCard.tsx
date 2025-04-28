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
  {
    iconName: IIconProps['name'];
    iconColor: IColorTokens;
    titleColor: IColorTokens;
  }
> = {
  unknown: {
    iconName: 'ShieldQuestionSolid',
    iconColor: '$iconSubdued',
    titleColor: '$text',
  },
  safe: {
    iconName: 'ShieldCheckDoneSolid',
    iconColor: '$iconSuccess',
    titleColor: '$text',
  },
  danger: {
    iconName: 'ShieldExclamationSolid',
    iconColor: '$iconCritical',
    titleColor: '$textCritical',
  },
  info: {
    iconName: 'BookOutline',
    iconColor: '$icon',
    titleColor: '$text',
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
      maxWidth={320}
    >
      <Stack
        flexDirection="row"
        alignItems="center"
        gap="$3"
        paddingBottom="$2"
        marginBottom="$3"
        borderBottomWidth={1}
        borderColor="$border-subdued"
      >
        <Stack padding="$1">
          <Icon name={config.iconName} color={config.iconColor} size="$5" />
        </Stack>
        <SizableText size="$bodyLgMedium" color={config.titleColor}>
          {title}
        </SizableText>
      </Stack>
      <SizableText size="$bodyMd" color="$text-subdued" paddingTop="$2">
        {description}
      </SizableText>
    </Stack>
  );
};
