import { ensureWorkerReady, workerApi } from './workerClient';

import type { IXmrRuntimeApi } from '..';

// Web and desktop run main and background in one JS runtime, so the wallet
// needs its own Worker to keep the UI responsive.
export async function getXmrRuntimeApiForCarrier(): Promise<IXmrRuntimeApi> {
  await ensureWorkerReady();
  return workerApi;
}
