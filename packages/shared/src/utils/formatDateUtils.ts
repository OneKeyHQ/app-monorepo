import dayjs from 'dayjs';

import { appLocale } from '../locale/appLocale';

export function formatHistoryRecordDate(timestamp: number) {
  const today = dayjs().startOf('day');
  const yesterday = dayjs().subtract(1, 'day').startOf('day');

  const inputDate = dayjs(timestamp);

  if (inputDate.isSame(today, 'day')) {
    return appLocale.intl.formatMessage({ id: 'content__today' });
  }
  if (inputDate.isSame(yesterday, 'day')) {
    return appLocale.intl.formatMessage({ id: 'content__yesterday' });
  }

  return inputDate.format('MMM DD YYYY');
}
