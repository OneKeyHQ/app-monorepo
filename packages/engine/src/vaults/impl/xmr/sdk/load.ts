import instantiate from './monero-core';

import type { MoneroCoreInstance } from './moneroTypes';

export const loadWasmInstance = async (
  importObj: any,
): Promise<MoneroCoreInstance | null> => instantiate(importObj);
