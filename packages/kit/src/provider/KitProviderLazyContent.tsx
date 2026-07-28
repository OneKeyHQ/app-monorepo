import { memo, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';

import LastActivityTracker from '../components/LastActivityTracker';
import PasswordVerifyPromptMount from '../components/Password/container/PasswordVerifyPromptMount';
import { SyncHomeAccountToDappAccountProvider } from '../views/Discovery/components/SyncDappAccountToHomeProvider';

import { StateActiveContainer } from './Container/StateActiveContainer';
import { HardwareServiceProvider } from './HardwareServiceProvider';
import { WebViewWebEmbedProvider } from './WebViewWebEmbedProvider';

type IDelayedMountProps = PropsWithChildren<{
  delayMs: number;
}>;

function DelayedMount({ delayMs, children }: IDelayedMountProps) {
  const [shouldMount, setShouldMount] = useState(delayMs <= 0);

  useEffect(() => {
    if (delayMs <= 0) {
      setShouldMount(true);
      return undefined;
    }
    const timer = setTimeout(() => {
      setShouldMount(true);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [delayMs]);

  return shouldMount ? <>{children}</> : null;
}

function KitProviderLazyContentBeforeLocaleCmp() {
  return (
    <>
      <PasswordVerifyPromptMount />
      <DelayedMount delayMs={1000}>
        <WebViewWebEmbedProvider />
      </DelayedMount>
      <DelayedMount delayMs={2500}>
        <LastActivityTracker />
      </DelayedMount>
    </>
  );
}

function KitProviderLazyContentAfterLocaleCmp() {
  return (
    <>
      <StateActiveContainer />
      <DelayedMount delayMs={1200}>
        <SyncHomeAccountToDappAccountProvider />
      </DelayedMount>
      <DelayedMount delayMs={200}>
        <HardwareServiceProvider />
      </DelayedMount>
    </>
  );
}

export const KitProviderLazyContentBeforeLocale = memo(
  KitProviderLazyContentBeforeLocaleCmp,
);
export const KitProviderLazyContentAfterLocale = memo(
  KitProviderLazyContentAfterLocaleCmp,
);
