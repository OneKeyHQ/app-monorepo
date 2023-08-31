/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access */
/* eslint-disable import/order */
import { useCallback, useEffect, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';

import { wait } from '@onekeyhq/kit/src/utils/helper';
import { ONBOARDING_WEBVIEW_METHODS } from '@onekeyhq/kit/src/views/Onboarding/screens/CreateWallet/BehindTheScene/consts';
import type { IProcessAutoTypingRef } from '@onekeyhq/kit/src/views/Onboarding/screens/CreateWallet/BehindTheScene/ProcessAutoTyping';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useRouteQuery } from '../../utils/useRouteQuery';

import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';
import { Box } from '@onekeyhq/components';
import ProcessAutoTyping from '@onekeyhq/kit/src/views/Onboarding/screens/CreateWallet/BehindTheScene/ProcessAutoTyping';

export function OnboardingAutoTyping() {
  const query = useRouteQuery();
  const typingRef = useRef<IProcessAutoTypingRef | null>(null);
  if (platformEnv.isDev) {
    // @ts-ignore
    window.$onboardingAutoTypingRef = typingRef;
  }
  useEffect(() => {
    if (!window.$onekey) {
      return;
    }
    const handler = (payload: IJsonRpcRequest) => {
      if (
        payload &&
        payload.method === ONBOARDING_WEBVIEW_METHODS.onboardingWalletCreated
      ) {
        typingRef.current?.handleWalletCreated();
      }
    };
    window.$onekey.$private.on('message_low_level', handler);
    return () => {
      window.$onekey.$private.off('message_low_level', handler);
    };
  }, []);
  const onPressFinished = useCallback(async () => {
    try {
      await window.$onekey.$private.request({
        method: ONBOARDING_WEBVIEW_METHODS.onboardingPressFinishButton,
      });
      await wait(3000);
    } catch (error) {
      console.error(error);
      alert((error as Error).message);
    }
    return Promise.resolve();
  }, []);
  const pausedProcessIndex = useMemo(() => {
    const index = query.get('pausedProcessIndex');
    const indexBN = new BigNumber(index ?? '');
    if (indexBN.isNaN()) {
      return 1;
    }
    return indexBN.toNumber();
  }, [query]);
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions
    <div
      onClick={() => {
        if (platformEnv.isDev) {
          typingRef.current?.handleWalletCreated();
        }
      }}
      id="WebOnboardingAutoTypingContainer"
      style={{ overflow: 'auto' }}
    >
      <Box h="full" minH="100vh" justifyContent="center">
        <ProcessAutoTyping
          ref={typingRef}
          minHeight={0}
          pausedProcessIndex={pausedProcessIndex}
          onPressFinished={onPressFinished}
        />
      </Box>
    </div>
  );
}
