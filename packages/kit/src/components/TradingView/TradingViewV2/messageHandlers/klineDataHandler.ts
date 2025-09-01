import { fetchTradingViewV2DataWithSlicing } from '../hooks';

import type { IMessageHandlerParams } from './types';

export async function handleKLineDataRequest({
  data,
  context,
}: IMessageHandlerParams): Promise<void> {
  const { tokenAddress = '', networkId = '', webRef } = context;

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
    const method = safeData.method as string;
    const resolution = safeData.resolution as string;
    const from = safeData.from as number;
    const to = safeData.to as number;
    const firstDataRequest = safeData.firstDataRequest as boolean;

    // console.log('TradingView request received:', {
    //   method,
    //   resolution,
    //   from,
    //   to,
    //   firstDataRequest,
    //   origin: data.origin,
    // });

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
    } catch (error) {
      console.error('Failed to fetch and send kline data:', error);
    }
  }
}
