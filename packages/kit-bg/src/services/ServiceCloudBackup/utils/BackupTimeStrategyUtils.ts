import {
  differenceInHours,
  differenceInMonths,
  differenceInWeeks,
} from 'date-fns';

import type { IMetaDataObject } from '../types';

export function filterWillRemoveBackupList(metaData: IMetaDataObject[]) {
  const currentDate = new Date();
  let willRemoveList = metaData.filter((current) => !current.isManualBackup);
  willRemoveList = willRemoveList.filter((current) => {
    const result = differenceInMonths(currentDate, current.backupTime) > 24;
    if (result) {
      return result;
    }
    const sameMonthList = willRemoveList.filter(
      (x) => differenceInMonths(current.backupTime, x.backupTime) === 0,
    );
    sameMonthList.sort((a, b) => b.backupTime - a.backupTime);
    return current.filename !== sameMonthList[0].filename;
  });
  willRemoveList = willRemoveList.filter((current) => {
    const result = differenceInWeeks(currentDate, current.backupTime) > 4;
    if (result) {
      return result;
    }
    const sameWeekList = willRemoveList.filter(
      (x) => differenceInWeeks(current.backupTime, x.backupTime) === 0,
    );
    sameWeekList.sort((a, b) => b.backupTime - a.backupTime);
    return current.filename !== sameWeekList[0].filename;
  });
  willRemoveList = willRemoveList.filter(
    (current) => differenceInHours(currentDate, current.backupTime) > 24,
  );
  return willRemoveList;
}
