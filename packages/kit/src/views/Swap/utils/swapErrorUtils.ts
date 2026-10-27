import BigNumber from 'bignumber.js';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type {
  IFetchQuoteResult,
  ISwapErrorMessage,
} from '@onekeyhq/shared/types/swap/types';

import type { IntlShape } from 'react-intl';

export function formatSwapErrorMessage(
  intl: IntlShape,
  error: ISwapErrorMessage,
) {
  return {
    title: intl.formatMessage({ id: error.key }, error.values),
    message: error.detail
      ? intl.formatMessage({ id: error.detail.key }, error.detail.values)
      : undefined,
  };
}

export function getSwapQuoteLimitError({
  limit,
  fromTokenAmount,
  fromTokenSymbol,
}: {
  limit?: IFetchQuoteResult['limit'];
  fromTokenAmount?: string;
  fromTokenSymbol?: string;
}): ISwapErrorMessage | undefined {
  const amount = new BigNumber(fromTokenAmount ?? 0);
  let rejected: { key: ETranslations; amount: string } | undefined;
  if (limit?.min && amount.lt(limit.min))
    rejected = {
      key: ETranslations.provider_min_amount_required,
      amount: limit.min,
    };
  else if (limit?.max && amount.gt(limit.max))
    rejected = {
      key: ETranslations.provider_max_amount_required,
      amount: limit.max,
    };
  return rejected
    ? {
        key: rejected.key,
        values: {
          amount: numberFormat(rejected.amount, { formatter: 'balance' }),
          token: fromTokenSymbol ?? 'unknown',
        },
      }
    : undefined;
}

export function getSwapQuoteLimitMessage({
  intl,
  ...params
}: Parameters<typeof getSwapQuoteLimitError>[0] & { intl: IntlShape }) {
  const error = getSwapQuoteLimitError(params);
  return error ? formatSwapErrorMessage(intl, error).title : undefined;
}

export function getSwapBalanceInsufficientError({
  networkId,
  tokenSymbol,
  reserveAmount,
}: {
  networkId?: string;
  tokenSymbol: string;
  reserveAmount?: string;
}): ISwapErrorMessage {
  const isBtcNetwork = networkUtils.isBTCNetwork(networkId);
  return {
    key: isBtcNetwork
      ? ETranslations.send_toast_btc_fork_insufficient_fund
      : ETranslations.swap_page_toast_insufficient_balance_title,
    values: { token: tokenSymbol },
    detail:
      !isBtcNetwork && reserveAmount
        ? {
            key: ETranslations.swap_page_toast_insufficient_balance_content,
            values: {
              token: tokenSymbol,
              number: numberFormat(reserveAmount, { formatter: 'balance' }),
            },
          }
        : undefined,
  };
}

export function getSwapBalanceInsufficientMessage({
  intl,
  ...params
}: Parameters<typeof getSwapBalanceInsufficientError>[0] & {
  intl: IntlShape;
}) {
  return formatSwapErrorMessage(intl, getSwapBalanceInsufficientError(params));
}
