import { useEffect, useRef } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EPasswordVerifyStatus } from '@onekeyhq/shared/types/password';

// Clear native DOM input values after password verification to prevent
// plaintext passwords from lingering in memory via the DOM element.
// On native platforms this is a no-op since there is no DOM.
export const useClearInputValueAfterVerified = platformEnv.isNative
  ? (_status: EPasswordVerifyStatus) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const formContainerRef = useRef(null);
      return formContainerRef;
    }
  : (status: EPasswordVerifyStatus) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const formContainerRef = useRef<HTMLDivElement>(null);

      // eslint-disable-next-line react-hooks/rules-of-hooks
      useEffect(() => {
        if (status === EPasswordVerifyStatus.VERIFIED) {
          setTimeout(() => {
            // Explicit delay to ensure DOM update completes before clearing
            if (formContainerRef.current) {
              const inputs =
                formContainerRef.current.querySelectorAll<HTMLInputElement>(
                  'input',
                );
              inputs.forEach((input) => {
                input.value = '';
              });
            }
          }, 50);
        }
      }, [status]);

      return formContainerRef;
    };
