import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import {
  formatBalance,
  formatDisplayNumber,
} from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketAccountTokenTransaction } from '@onekeyhq/shared/types/marketV2';

import { MESSAGE_TYPES } from '../../TradingViewPerpsV2/constants/messageTypes';
import { fetchTradingViewV2DataWithSlicing } from '../hooks';

import type { IMessageHandlerContext, IMessageHandlerParams } from './types';

const MAX_MARKS_COUNT = 60;

function formatAmount(amount: string) {
  const result = formatDisplayNumber(formatBalance(amount));
  return typeof result === 'string' ? result : amount;
}

function buildTransactionMarks({
  transactions,
}: {
  transactions: IMarketAccountTokenTransaction[];
}) {
  const limitedList = transactions
    .slice()
    .filter((tx) => tx.to?.amount && tx.to?.symbol)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-MAX_MARKS_COUNT);

  return limitedList.map((tx, index) => {
    const isBuy = tx.type === 'buy';
    const label = isBuy ? 'B' : 'S';
    const displayAmount = tx.to.amount;
    const displaySymbol = tx.to.symbol;
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
      time: Math.floor(tx.timestamp),
      text,
      label,
      color: isBuy ? '#0A7AFF' : '#FF4D4F',
    };
  });
}

export async function fetchAndSendAccountMarks({
  accountAddress,
  tokenAddress,
  networkId,
  from,
  to,
  symbol,
  webRef,
}: {
  accountAddress?: string;
  tokenAddress: string;
  networkId: string;
  from: number;
  to: number;
  symbol?: string;
  webRef: IMessageHandlerContext['webRef'];
}) {
  if (!accountAddress) {
    return;
  }
  try {
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

    const marks = buildTransactionMarks({
      transactions: accountTransactions.list ?? [],
    });

    if (webRef.current && marks.length > 0) {
      webRef.current.sendMessageViaInjectedScript({
        type: MESSAGE_TYPES.MARKS_UPDATE,
        payload: {
          marks,
          symbol: symbol || tokenAddress,
          operation: 'replace',
        },
      });
    }
  } catch (error) {
    console.error('Failed to fetch account token transactions:', error);
  }
}

export async function handleKLineDataRequest({
  data,
  context,
}: IMessageHandlerParams): Promise<void> {
  const { tokenAddress = '', networkId = '', webRef, accountAddress } = context;

  // Safely extract history data with proper type checking
  const messageData = data.data;

  if (
    messageData &&
    typeof messageData === 'object' &&
    'method' in messageData &&
    'resolution' in messageData &&
    'from' in messageData &&
    'to' in messageData
  ) {
    // Extract properties safely with explicit checks
    const safeData = messageData as unknown as Record<string, unknown>;
    const resolution = safeData.resolution as string;
    const from = safeData.from as number;
    const to = safeData.to as number;

    // Use combined function to get sliced data
    try {
      const kLineData = await fetchTradingViewV2DataWithSlicing({
        tokenAddress,
        networkId,
        interval: resolution,
        timeFrom: from,
        timeTo: to,
      });

      if (webRef.current && kLineData) {
        webRef.current.sendMessageViaInjectedScript({
          type: 'kLineData',
          payload: {
            type: 'history',
            kLineData,
            requestData: messageData,
          },
        });
      }

      if (accountAddress && tokenAddress && networkId) {
        void fetchAndSendAccountMarks({
          accountAddress,
          tokenAddress,
          networkId,
          from,
          to,
          symbol: (safeData.symbol as string) || tokenAddress,
          webRef,
        });
      }
    } catch (error) {
      console.error('Failed to fetch and send kline data:', error);
    }
  }
}
