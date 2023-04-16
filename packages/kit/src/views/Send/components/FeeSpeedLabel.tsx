import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import { HStack, Text } from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import type { IFeeInfoPrice } from '@onekeyhq/engine/src/vaults/types';

type Props = {
  index?: number | string;
  isCustom?: boolean;
  iconSize?: number;
  prices?: IFeeInfoPrice[];
} & ComponentProps<typeof HStack>;

export function FeeSpeedLabel({
  index,
  isCustom,
  iconSize = 18,
  prices,
  ...rest
}: Props) {
  const intl = useIntl();
  let indexInt = parseInt(index as string, 10);

  if (prices && prices.length === 1) {
    indexInt = 1;
  }

  let titleId: LocaleIds;
  let titleIcon = '';

  if (isCustom) {
    titleIcon = '⚙️';
    titleId = 'form__gear_custom';
  } else {
    switch (indexInt) {
      case 0:
        titleIcon = '🚴🏻';
        titleId = 'form__low';
        break;
      case 1:
        titleIcon = '🚕';
        titleId = 'form__market';
        break;
      case 2:
        titleIcon = '🚅';
        titleId = 'form__aggressive';
        break;
      default:
        titleIcon = '🚕';
        titleId = 'form__market';
    }
  }

  return (
    <HStack {...rest}>
      <Text fontSize={iconSize}>{titleIcon}</Text>
      <Text typography="Body1Strong">
        {intl.formatMessage({ id: titleId })}
      </Text>
    </HStack>
  );
}
