import { useIntl } from 'react-intl';

import { Button, DatePicker, YStack, useMedia } from '@onekeyhq/components';
import type { IDateRange, IDateRangePreset } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import { ReferFriendsTestIDs } from '../testIDs';

// The earliest date the reward pages query; a range from it to today is the
// "All time" preset.
const ALL_TIME_START = new Date('2024-01-01T00:00:00.000');

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

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
  if (isSameDay(start, ALL_TIME_START) && isSameDay(end, new Date())) {
    return allTime;
  }
  const endTemplate =
    start.getFullYear() === end.getFullYear() ? 'LL/dd' : 'yyyy/LL/dd';
  return `${formatDate(start, { formatTemplate: 'yyyy/LL/dd' })} – ${formatDate(
    end,
    { formatTemplate: endTemplate },
  )}`;
}

// Date range filter for the reward pages. Compact layouts swap the wide input
// for a chip that reads the range (or "All time"); the presets inside the
// picker, "All time" among them, replace its clear button.
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
  const { md } = useMedia();

  if (!md) {
    return (
      <YStack width={240}>
        <DatePicker.Range
          value={value}
          onChange={onChange}
          maxDate={maxDate}
          showPreviousMonth
          presets={presets}
        />
      </YStack>
    );
  }

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
