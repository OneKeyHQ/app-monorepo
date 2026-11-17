import { EAppEventBusNames, appEventBus } from '../../eventBus/appEventBus';
import { ETranslations } from '../../locale';
import { appLocale } from '../../locale/appLocale';

import type { IOneKeyError } from '../../errors/types/errorTypes';

// Support entry points call showIntercom fire-and-forget, so a failed open
// must surface here instead of becoming a silent tap.
export function notifyIntercomOpenFailed(error: unknown) {
  console.warn('Failed to open Intercom', error);
  // Auto-toast errors are already shown by the global error handler.
  if ((error as IOneKeyError | undefined)?.autoToast) {
    return;
  }
  appEventBus.emit(EAppEventBusNames.ShowToast, {
    method: 'error',
    title: appLocale.intl.formatMessage({
      id: ETranslations.global_unknown_error_retry_message,
    }),
  });
}
