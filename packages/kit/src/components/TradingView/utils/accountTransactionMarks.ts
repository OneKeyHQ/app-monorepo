import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import {
  formatBalance,
  formatDisplayNumber,
} from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketAccountTokenTransaction } from '@onekeyhq/shared/types/marketV2';

const MAX_MARKS_COUNT = 60;

function formatAmount(amount: string) {
  const result = formatDisplayNumber(formatBalance(amount));
  return typeof result === 'string' ? result : amount;
}

export function buildTransactionMarks({
  transactions,
}: {
  transactions: IMarketAccountTokenTransaction[];
}) {
  const limitedList = transactions
    .slice()
    .filter((tx) => tx.to?.amount && tx.to?.symbol)
    .toSorted((a, b) => a.timestamp - b.timestamp)
    .slice(-MAX_MARKS_COUNT);

  return limitedList.map((tx, index) => {
    const isBuy = tx.type === 'buy';
    const label: 'B' | 'S' = isBuy ? 'B' : 'S';
    const displayAmount = tx.to.amount;
    const displaySymbol = tx.to.symbol;
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    const text = appLocale.intl.formatMessage(
      {
        id: isBuy
          ? ETranslations.dexmarket_point_buy
          : ETranslations.dexmarket_point_sell,
      },
      {
        Amount: formatAmount(displayAmount),
        From_Token: displaySymbol,
        to_Token: displaySymbol,
      },
    );
    return {
      id: `${tx.hash}-${isBuy ? 'buy' : 'sell'}-${index}`,
      transactionHash: tx.hash,
      time: Math.floor(tx.timestamp),
      text,
      label,
      color: isBuy ? '#0A7AFF' : '#FF4D4F',
    };
  });
}

export type IAccountTransactionMark = ReturnType<
  typeof buildTransactionMarks
>[number];

export async function fetchAccountTransactionMarks({
  accountAddress,
  tokenAddress,
  networkId,
  from,
  to,
}: {
  accountAddress?: string;
  tokenAddress: string;
  networkId: string;
  from: number;
  to: number;
}) {
  if (!accountAddress) {
    return [];
  }

  const accountTransactions =
    await backgroundApiProxy.serviceMarketV2.fetchMarketAccountTokenTransactions(
      {
        accountAddress,
        tokenAddress,
        networkId,
        timeFrom: from,
        timeTo: to,
      },
    );

  return buildTransactionMarks({
    transactions: accountTransactions.list ?? [],
  });
}
