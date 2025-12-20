import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import {
  handleBitrefillWebViewMessage,
  isBitrefillOrigin,
} from '../utils/bitrefillHandler';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

/**
 * Hook to handle Discovery WebView messages
 * This centralizes message handling for special sites like Bitrefill
 */
export function useDiscoveryMessageHandler({ url }: { url: string }) {
  const customReceiveHandler = useCallback(
    async (payload: IJsBridgeMessagePayload) => {
      const { data, origin } = payload;

      // Debug log for development
      if (__DEV__) {
        console.log('[Discovery] customReceiveHandler received:', {
          url,
          origin,
          data,
        });
      }

      // Handle Bitrefill messages
      if (isBitrefillOrigin(url) || isBitrefillOrigin(origin ?? '')) {
        try {
          const messageData =
            typeof data === 'string' ? data : JSON.stringify(data);
          const handled = await handleBitrefillWebViewMessage({
            url,
            messageData,
            backgroundApi: backgroundApiProxy,
          });
          if (handled) {
            console.log('[Discovery] Bitrefill message handled');
          }
        } catch (error) {
          console.error('[Discovery] Error handling Bitrefill message:', error);
        }
      }

      // Add more site-specific handlers here as needed
    },
    [url],
  );

  return { customReceiveHandler };
}
