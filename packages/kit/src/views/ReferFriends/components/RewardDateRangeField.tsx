import { isSameDay } from 'date-fns';
import { useIntl } from 'react-intl';

import { Button, DatePicker } from '@onekeyhq/components';
import type { IDateRange, IDateRangePreset } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import { REFERRAL_ALL_TIME_START } from '../hooks/useDatePresets';
import { ReferFriendsTestIDs } from '../testIDs';

export function formatRangeLabel(
  range: IDateRange | undefined,
  allTime: string,
) {
  const { start, end } = range ?? { start: null, end: null };
  if (!start || !end) {
    return start
      ? formatDate(start, { formatTemplate: 'yyyy/LL/dd' })
      : allTime;
  }
  if (isSameDay(start, REFERRAL_ALL_TIME_START) && isSameDay(end, new Date())) {
    return allTime;
  }
  const endTemplate =
    start.getFullYear() === end.getFullYear() ? 'LL/dd' : 'yyyy/LL/dd';
  return `${formatDate(start, { formatTemplate: 'yyyy/LL/dd' })} – ${formatDate(
    end,
    { formatTemplate: endTemplate },
  )}`;
}

// Date range filter for the reward pages: a chip that reads the range (or
// "All time"), matching the Filter and Export buttons beside it. The presets
// inside the picker, "All time" among them, replace an input's clear button.
export function RewardDateRangeField({
  value,
  onChange,
  maxDate,
  presets,
}: {
  value: IDateRange | undefined;
  onChange: (range: IDateRange) => void;
  maxDate: Date;
  presets: IDateRangePreset[];
}) {
  const intl = useIntl();
  return (
    <DatePicker.Range
      value={value}
      onChange={onChange}
      maxDate={maxDate}
      showPreviousMonth
      presets={presets}
      renderTrigger={() => (
        <Button
          testID={ReferFriendsTestIDs.dateRangeChip}
          size="small"
          variant="secondary"
          icon="CalendarOutline"
        >
          {formatRangeLabel(
            value,
            intl.formatMessage({ id: ETranslations.referral_filter_alltime }),
          )}
        </Button>
      )}
    />
  );
}
