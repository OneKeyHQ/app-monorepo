import { useEffect, useRef } from 'react';

import { Stack } from '@onekeyhq/components';
import { isWcPayTrustedHost } from '@onekeyhq/shared/src/walletConnect/payConstant';

import type { IDataCollectionViewProps } from './types';

/**
 * Web/desktop variant: the hosted compliance form runs in an iframe and
 * reports completion via window postMessage (IC_COMPLETE / IC_ERROR).
 */
export function DataCollectionView({
  url,
  onComplete,
  onError,
}: IDataCollectionViewProps) {
  const completedRef = useRef(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        if (!isWcPayTrustedHost(new URL(event.origin).hostname)) {
          return;
        }
        const data =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type === 'IC_COMPLETE' && !completedRef.current) {
          completedRef.current = true;
          onComplete();
        } else if (data?.type === 'IC_ERROR' && !completedRef.current) {
          completedRef.current = true;
          onError(String(data?.error ?? 'Data collection failed'));
        }
      } catch {
        // ignore non-JSON messages
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onComplete, onError]);

  return (
    <Stack flex={1}>
      <iframe
        src={url}
        title="WalletConnect Pay"
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          border: 'none',
        }}
        sandbox="allow-scripts allow-forms allow-same-origin"
      />
    </Stack>
  );
}
