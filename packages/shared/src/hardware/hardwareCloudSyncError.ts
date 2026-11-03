/* eslint-disable max-classes-per-file */
import { OneKeyError, OneKeyLocalError } from '../errors';
import { normalizeErrorProps } from '../errors/utils/errorUtils';
import { ETranslations } from '../locale';

// Shown to the user; the English text is the fallback when no locale is loaded.
export class HardwareCloudSyncError extends OneKeyError {
  constructor(key: ETranslations, defaultMessage: string) {
    super(normalizeErrorProps({ key }, { defaultMessage }));
  }
}

// Same as HardwareCloudSyncError for failures that stay local errors.
export class HardwareCloudSyncLocalError extends OneKeyLocalError {
  constructor(key: ETranslations, defaultMessage: string) {
    super(normalizeErrorProps({ key }, { defaultMessage }));
  }
}

// Server data failed a Cloud sync check (malformed, tampered or rolled back).
// Users see one plain message; `reason` keeps the specific check for logs.
export class HardwareCloudSyncDataError extends OneKeyLocalError {
  readonly reason: string;

  constructor(reason: string) {
    super(
      normalizeErrorProps(
        { key: ETranslations.cloud_sync_data_unreadable__msg },
        { defaultMessage: "Couldn't read Cloud sync data. Try again later." },
      ),
    );
    this.reason = reason;
  }
}
