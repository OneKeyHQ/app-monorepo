import { ensureWorkerReady, workerApi } from './workerClient';

import type { IXmrRuntimeApi } from '..';

// App main and background share one JS runtime on web and desktop, so "the
// background is doing it" is not a defense against blocking the UI -- the
// wallet gets its own Worker.
export async function getXmrRuntimeApiForCarrier(): Promise<IXmrRuntimeApi> {
  await ensureWorkerReady();
  return workerApi;
}
