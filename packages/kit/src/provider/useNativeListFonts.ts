import { useEffect, useState } from 'react';

import { configureNativeListFonts } from '@onekeyfe/react-native-native-list';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

let loading: Promise<void> | undefined;
let settled = false;

export function useNativeListFonts() {
  const [ready, setReady] = useState(settled);
  useEffect(() => {
    let mounted = true;
    loading ??= (async () => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const faces = await Promise.race([
          Promise.all(
            [400, 500, 600, 700].map((weight) =>
              document.fonts.load(`${weight} 16px "Roobert"`),
            ),
          ),
          new Promise<never>((_resolve, reject) => {
            timeout = setTimeout(
              () => reject(new OneKeyLocalError('Host font loading timed out')),
              3000,
            );
          }),
        ]);
        if (faces.some((loaded) => loaded.length === 0))
          throw new OneKeyLocalError('Missing Roobert font faces');
        configureNativeListFonts({
          regular: 'Roobert',
          medium: 'Roobert',
          semibold: 'Roobert',
          bold: 'Roobert',
        });
      } catch {
        defaultLogger.app.error.log(
          'NativeList host fonts unavailable; using system fonts',
        );
      } finally {
        if (timeout) clearTimeout(timeout);
      }
      settled = true;
    })();
    void loading.then(() => {
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);
  return ready;
}
