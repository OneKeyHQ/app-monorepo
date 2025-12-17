import memoize from 'memoizee';

import { ELockDuration } from '@onekeyhq/shared/src/consts/appAutoLockConsts';

export const isNeverLockDuration = memoize((appLockDuration: number) => {
  return String(appLockDuration) === ELockDuration.Never;
});
