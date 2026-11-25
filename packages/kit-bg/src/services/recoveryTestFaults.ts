import { devSettingsPersistAtom } from '../states/jotai/atoms/devSettings';

import { consumeAppRecoveryTestFault } from './appResetState';

import type { IAppRecoveryTestFault } from './appResetState';

export async function takeRecoveryTestFault(
  fault: IAppRecoveryTestFault,
): Promise<boolean> {
  try {
    if (!(await devSettingsPersistAtom.get()).enabled) return false;
    return await consumeAppRecoveryTestFault(fault);
  } catch {
    return false;
  }
}
