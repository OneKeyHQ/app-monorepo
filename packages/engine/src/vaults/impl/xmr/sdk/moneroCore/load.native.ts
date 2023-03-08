import instantiate from './moneroCore';

import type { MoneroCoreInstance } from './moneroCoreTypes';

export const loadWasmInstance = async (
  importObj: any,
): Promise<MoneroCoreInstance | null> => instantiate(importObj);
