import { useCallback } from 'react';

import type { IWebViewRef } from '../../../WebView/types';
import type {
  IGetMarksRequest,
  IGetMarksResponse,
  ITradingMark,
} from '../types';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

export function usePerpsMessageHandler({
  webRef,
}: {
  symbol: string;
  userAddress?: string;
  webRef: React.RefObject<IWebViewRef | null>;
}) {
  const handleGetMarks = useCallback(
    async (_request: IGetMarksRequest) => {
      const marks: ITradingMark[] = [
        {
          id: 'buy_1',
          time: Date.now() / 1000 - 3600,
          color: '#26a69a',
          text: 'Buy 0.1 @ 45000',
          label: 'B',
          labelFontColor: '#FFFFFF',
          size: 'normal',
          shape: 'arrowUp',
        },
        {
          id: 'sell_1',
          time: Date.now() / 1000 - 1800,
          color: '#ef5350',
          text: 'Sell 0.05 @ 46000',
          label: 'S',
          labelFontColor: '#FFFFFF',
          size: 'normal',
          shape: 'arrowDown',
        },
      ];

      const response: IGetMarksResponse = { marks };

      webRef.current?.sendMessageViaInjectedScript({
        type: 'MARKS_RESPONSE',
        payload: response,
      });
    },
    [webRef],
  );

  const customReceiveHandler = useCallback(
    async (payload: IJsBridgeMessagePayload) => {
      const { data } = payload;
      if (typeof data !== 'object' || data === null) return;
      if (
        (data as { scope?: string })?.scope === '$private' &&
        (data as { method?: string })?.method === 'tradingview_getMarks'
      ) {
        await handleGetMarks(
          (data as { data?: unknown }).data as IGetMarksRequest,
        );
      }
    },
    [handleGetMarks],
  );

  return { customReceiveHandler };
}
