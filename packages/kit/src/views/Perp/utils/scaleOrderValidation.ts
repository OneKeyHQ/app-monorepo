import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IScaleOrderValidationIssue,
  IScaleOrderValidationResult,
} from '@onekeyhq/shared/types/hyperliquid/types';

import type { IntlShape } from 'react-intl';

export function formatScaleOrderValidationError(
  intl: IntlShape,
  issue?: IScaleOrderValidationIssue,
  error?: string,
) {
  switch (issue?.code) {
    case 'sizeTooSmall':
      return intl.formatMessage({
        id: ETranslations.perp_scale_order_size_too_small__msg,
      });
    case 'minNotionalTooSmall':
      return intl.formatMessage(
        {
          id: ETranslations.perp_scale_order_min_notional__msg,
        },
        { amount: `$${issue.minNotional ?? '10'}` },
      );
    default:
      return error;
  }
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
    formatScaleOrderValidationError(
      intl,
      validation.issues[0],
      validation.errors[0],
    ) ?? fallback
  );
}
