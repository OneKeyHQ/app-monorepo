import { useIntl } from 'react-intl';

import { Text } from '@onekeyhq/components';
import type {
  IFeeInfoPrice,
  IFeeInfoUnit,
} from '@onekeyhq/engine/src/vaults/types';

import { getCustomFeeSpeedInfo } from '../utils/getCustomFeeSpeedInfo';

function getSpeedColor(seconds: number) {
  if (seconds < 15) {
    return 'text-success';
  }

  if (seconds <= 30) {
    return 'text-success';
  }

  return 'text-warning';
}

export function FeeSpeedTime({
  index,
  waitingSeconds,
  withColor,
  prices,
}: {
  index: number | string;
  waitingSeconds: number | undefined;
  withColor?: boolean;
  prices?: IFeeInfoPrice[];
}) {
  const intl = useIntl();
  let indexInt = parseInt(index as string, 10);
  let title = '<15s';
  let seconds = waitingSeconds;

  if (prices && prices.length === 1) {
    indexInt = 1;
  }

  if (waitingSeconds) {
    title = intl.formatMessage(
      { id: 'content__about_int_str' },
      {
        time:
          waitingSeconds > 60 ? Math.ceil(waitingSeconds / 60) : waitingSeconds,
        unit: intl.formatMessage({
          id:
            waitingSeconds > 60
              ? 'content__minutes_lowercase'
              : 'content__seconds__lowercase',
        }),
      },
    );
  } else {
    if (indexInt === 0) {
      title = '>30s';
      seconds = 31;
    }
    if (indexInt === 1) {
      title = '~30s';
      seconds = 30;
    }
    if (indexInt === 2) {
      title = '<15s';
      seconds = 14;
    }
  }
  return withColor ? (
    <Text color={getSpeedColor(seconds as number)}>{title}</Text>
  ) : (
    <>{title}</>
  );
}

export function CustomFeeSpeedTime({
  custom,
  prices,
  isEIP1559Fee,
  waitingSeconds,
  withColor,
}: {
  prices: IFeeInfoPrice[];
  waitingSeconds: number[];
  custom?: IFeeInfoUnit;
  isEIP1559Fee?: boolean;
  withColor?: boolean;
}) {
  if (!custom) return null;

  const { customSimilarToPreset, customWaitingSeconds } = getCustomFeeSpeedInfo(
    {
      custom,
      prices,
      isEIP1559Fee,
      waitingSeconds,
    },
  );

  return (
    <FeeSpeedTime
      withColor={withColor}
      index={customSimilarToPreset}
      waitingSeconds={customWaitingSeconds}
    />
  );
}
