import { useIntl } from 'react-intl';

import { HStack, Text } from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import type { IFeeInfoPrice } from '@onekeyhq/engine/src/vaults/types';

export function FeeSpeedLabel({
  index,
  isCustom,
  iconSize = 18,
  prices,
}: {
  index?: number | string;
  isCustom?: boolean;
  iconSize?: number;
  prices?: IFeeInfoPrice[];
}) {
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
    <HStack alignItems="center" space={2}>
      <Text fontSize={iconSize}>{titleIcon}</Text>
      <Text>{intl.formatMessage({ id: titleId })}</Text>
    </HStack>
  );
}
