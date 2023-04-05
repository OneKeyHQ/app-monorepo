import { useIntl } from 'react-intl';

import { HStack, Text } from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';

export function FeeSpeedLabel({
  index,
  isCustom,
  iconSize = 18,
}: {
  index?: number | string;
  isCustom?: boolean;
  iconSize?: number;
}) {
  const intl = useIntl();
  const indexInt = parseInt(index as string, 10);

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
