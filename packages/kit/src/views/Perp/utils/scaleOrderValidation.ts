import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IScaleOrderValidationResult } from '@onekeyhq/shared/types/hyperliquid/types';
import type { IntlShape } from 'react-intl';

const SCALE_ORDER_SIZE_TOO_SMALL_PATTERN = /^Leg \d+: size is too small$/;

export function formatScaleOrderValidationError(
  intl: IntlShape,
  error?: string,
) {
  if (!error) {
    return undefined;
  }

  if (SCALE_ORDER_SIZE_TOO_SMALL_PATTERN.test(error)) {
    return intl.formatMessage({
      id: ETranslations.perp_scale_order_size_too_small__msg,
    });
  }

  return error;
}

export function getScaleOrderValidationErrorMessage({
  intl,
  validation,
  fallback,
}: {
  intl: IntlShape;
  validation: IScaleOrderValidationResult;
  fallback: string;
}) {
  return (
    formatScaleOrderValidationError(intl, validation.errors[0]) ?? fallback
  );
}
