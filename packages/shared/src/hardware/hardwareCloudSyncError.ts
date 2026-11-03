import { OneKeyError } from '../errors';
import { normalizeErrorProps } from '../errors/utils/errorUtils';

import type { ETranslations } from '../locale';

// Shown to the user; the English text is the fallback when no locale is loaded.
export class HardwareCloudSyncError extends OneKeyError {
  constructor(key: ETranslations, defaultMessage: string) {
    super(normalizeErrorProps({ key }, { defaultMessage }));
  }
}
