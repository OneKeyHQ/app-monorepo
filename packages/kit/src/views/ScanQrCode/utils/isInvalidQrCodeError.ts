import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';

// The class name does not survive minification across the bg bridge; its key does.
export function isInvalidQrCodeError(error: unknown): boolean {
  return (
    (error as IOneKeyError | undefined)?.key ===
    ETranslations.feedback_invalid_qr_code
  );
}
