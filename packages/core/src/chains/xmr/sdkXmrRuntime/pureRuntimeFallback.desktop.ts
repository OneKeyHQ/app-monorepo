import { OneKeyLocalError } from '@onekeyhq/shared/src/errors/errors/localError';

import type { IXmrPureRuntimeApi } from './address';

// installXmrCarrier runs before any pure call; an in-process fallback here
// would only bundle the runtime a second time.
export async function loadXmrPureRuntimeInProcess(): Promise<IXmrPureRuntimeApi> {
  throw new OneKeyLocalError('xmr: the runtime carrier is not installed');
}
