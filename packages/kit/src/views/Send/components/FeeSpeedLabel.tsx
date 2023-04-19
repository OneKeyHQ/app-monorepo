import type { ComponentProps } from 'react';
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { HStack, Text } from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import type { IFeeInfoPrice } from '@onekeyhq/engine/src/vaults/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
        titleId = 'form__normal';
        break;
      case 2:
        titleIcon = '🚅';
        titleId = 'form__high';
        break;
      default:
        titleIcon = '🚕';
        titleId = 'form__normal';
    }
  }

  // car emoji hack on Android
  const getIconPosition = useCallback(() => {
    if (!isCustom && indexInt === 1 && platformEnv.isNativeAndroid) {
      if (iconSize > 20) {
        return {
          mt: '-10px',
        };
      }

      return {
        mt: '-5px',
      };
    }
  }, [iconSize, indexInt, isCustom]);

  return (
    <HStack alignItems="center" {...rest}>
      <Text {...getIconPosition()} fontSize={iconSize}>
        {titleIcon}
      </Text>
      <Text typography="Body1Strong">
        {intl.formatMessage({ id: titleId })}
      </Text>
    </HStack>
  );
}
