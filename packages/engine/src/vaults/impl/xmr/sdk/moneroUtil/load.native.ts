import instantiate from './moneroUtil';

import type { MoneroUtilInstance } from './moneroUtilTypes';

export const loadWasmInstance = async (
  importObj: any,
): Promise<MoneroUtilInstance | null> => instantiate(importObj);
