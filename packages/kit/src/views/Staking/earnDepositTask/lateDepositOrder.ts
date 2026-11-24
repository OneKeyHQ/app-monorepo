import { createLateEarnOrderRecorder } from '@onekeyhq/kit/src/views/Earn/tasks/lateEarnOrderRecorder';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IRecordingResult } from './runDepositTask';

export function createLateDepositOrderRecorder() {
  const record = createLateEarnOrderRecorder();
  return async (
    params: Parameters<typeof record>[0],
  ): Promise<IRecordingResult> => {
    const result = await record(params);
    if (result === 'synced') return;
    if (result === 'existingOrder') return 'remoteUnknown';
    if (
      result === 'superseded' ||
      result === 'remoteUnknown' ||
      result === 'localUnavailable' ||
      result === 'notTracked'
    )
      return result;
    throw new OneKeyLocalError('Unable to record late deposit order');
  };
}
