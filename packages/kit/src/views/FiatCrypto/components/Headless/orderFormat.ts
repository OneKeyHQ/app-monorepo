import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  formatRelativeDate,
  formatTime,
} from '@onekeyhq/shared/src/utils/dateUtils';
import type { IHeadlessBuyOrder } from '@onekeyhq/shared/types/fiatCrypto';

import { formatPrice } from './DetailRow';

import type { IntlShape } from 'react-intl';

// "Buy ETH · $100.00" — banner rows, list rows and the detail header.
export function formatHeadlessBuyOrderTitle(
  intl: IntlShape,
  order: IHeadlessBuyOrder,
): string {
  return intl.formatMessage(
    { id: ETranslations.buy_order_summary__title },
    { token: order.tokenSymbol, amount: formatPrice(order.fiatAmount) },
  );
}

// "Today 14:02" / "2026/10/12 09:30" — the moment the order was submitted.
export function formatHeadlessBuyOrderTime(order: IHeadlessBuyOrder): string {
  const date = new Date(order.submittedAt ?? order.createdAt);
  return `${formatRelativeDate(date)} ${formatTime(date, {
    hideSeconds: true,
  })}`;
}
