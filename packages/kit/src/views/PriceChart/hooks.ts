import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import useFormatDate from '../../hooks/useFormatDate';

import { TIMEOPTIONS_MESSAGEID } from './TimeControl';

export const useChartTimeLabel = (
  selectedTimeIndex: number,
  sinceTime?: number,
) => {
  const intl = useIntl();
  const { formatDate } = useFormatDate();
  return useMemo(() => {
    if (selectedTimeIndex === TIMEOPTIONS_MESSAGEID.length - 1) {
      return intl.formatMessage(
        {
          id: TIMEOPTIONS_MESSAGEID[selectedTimeIndex],
        },
        { 0: sinceTime ? formatDate(new Date(sinceTime)).split(',')?.[0] : '' },
      );
    }
    return intl.formatMessage({
      id: TIMEOPTIONS_MESSAGEID[selectedTimeIndex],
    });
  }, [formatDate, intl, selectedTimeIndex, sinceTime]);
};
