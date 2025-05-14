import type { FC } from 'react';

import { Icon, Stack } from '@onekeyhq/components';
import type { IColorTokens, IIconProps } from '@onekeyhq/components';

import { useRiskIndicator } from './useRiskIndicator';

import type { IRiskIndicatorType } from './useRiskIndicator';

interface IRiskIndicatorIconProps {
  // Either provide a `type` so the icon config can be derived automatically
  type?: IRiskIndicatorType;
  // Or provide explicit icon name & color to override
  iconName?: IIconProps['name'];
  iconColor?: IColorTokens;
}

export const RiskIndicatorIcon: FC<IRiskIndicatorIconProps> = ({
  type,
  iconName,
  iconColor,
}) => {
  const config = useRiskIndicator(type ?? 'unknown');

  return (
    <Stack padding="$1">
      <Icon
        name={iconName ?? config.iconName}
        color={iconColor ?? config.iconColor}
        size="$5"
      />
    </Stack>
  );
};
