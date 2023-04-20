import type { ComponentProps } from 'react';

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
  typography,
}: {
  index: number | string;
  waitingSeconds: number | undefined;
  withColor?: boolean;
  prices?: IFeeInfoPrice[];
  typography?: ComponentProps<typeof Text>['typography'];
}) {
  const intl = useIntl();
  let indexInt = parseInt(index as string, 10);
  let title = `< ${intl.formatMessage(
    { id: 'content__str_seconds_plural' },
    { 0: '15' },
  )}`;
  let seconds = waitingSeconds;

  if (prices && prices.length === 1) {
    indexInt = 1;
  }

  if (waitingSeconds) {
    const time =
      waitingSeconds > 60 ? Math.ceil(waitingSeconds / 60) : waitingSeconds;
    const content = intl.formatMessage(
      {
        id:
          waitingSeconds > 60
            ? 'content__str_minutes_plural'
            : 'content__str_seconds_plural',
      },
      { 0: time },
    );
    title = `~ ${content}`;
  } else {
    if (indexInt === 0) {
      title = `> ${intl.formatMessage(
        { id: 'content__str_seconds_plural' },
        { 0: '30' },
      )}`;
      seconds = 31;
    }
    if (indexInt === 1) {
      title = `~ ${intl.formatMessage(
        { id: 'content__str_seconds_plural' },
        { 0: '30' },
      )}`;
      seconds = 30;
    }
    if (indexInt === 2) {
      title = `< ${intl.formatMessage(
        { id: 'content__str_seconds_plural' },
        { 0: '15' },
      )}`;
      seconds = 14;
    }
  }
  return withColor ? (
    <Text typography={typography} color={getSpeedColor(seconds as number)}>
      {title}
    </Text>
  ) : (
    <Text typography={typography} color="text-subdued">
      {title}
    </Text>
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
