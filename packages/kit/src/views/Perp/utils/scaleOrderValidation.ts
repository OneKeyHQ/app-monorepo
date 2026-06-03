import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IScaleOrderValidationIssue,
  IScaleOrderValidationResult,
} from '@onekeyhq/shared/types/hyperliquid/types';

import type { IntlShape } from 'react-intl';

const SCALE_ORDER_MIN_NOTIONAL_I18N_KEY =
  'perp_scale_order_min_notional__msg' as ETranslations;

function getScaleOrderMinNotionalDefaultMessage(locale?: string) {
  if (locale?.toLowerCase().startsWith('zh')) {
    return '每笔分段委托金额至少为 {amount}。请减少委托笔数或增加数量。';
  }
  return 'Each scale order must be at least {amount}. Reduce order count or increase size.';
}

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
          id: SCALE_ORDER_MIN_NOTIONAL_I18N_KEY,
          defaultMessage: getScaleOrderMinNotionalDefaultMessage(intl.locale),
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
