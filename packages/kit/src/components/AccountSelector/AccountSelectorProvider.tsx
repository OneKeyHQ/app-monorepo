import { useEffect } from 'react';

import { AccountSelectorJotaiProvider } from '../../states/jotai/contexts/accountSelector';

import { AccountSelectorEffects } from './AccountSelectorEffects';
import { accountSelectorStore } from './accountSelectorStore';

import type { IAccountSelectorContextData } from '../../states/jotai/contexts/accountSelector';

export function AccountSelectorProvider({
  children,
  config,
  enabledNum,
}: {
  children: any;
  config: IAccountSelectorContextData;
  enabledNum: number[];
}) {
  const store = accountSelectorStore.getOrCreateStore({ config });
  useEffect(
    () => () => {
      accountSelectorStore.removeStore({ config });
    },
    [config],
  );
  return (
    <AccountSelectorJotaiProvider store={store} config={config}>
      {enabledNum.map((num) => (
        <AccountSelectorEffects key={num} num={num} />
      ))}
      {children}
    </AccountSelectorJotaiProvider>
  );
}

export function AccountSelectorProviderMirror({
  children,
  config,
}: {
  children: any;
  config: IAccountSelectorContextData;
}) {
  const store = accountSelectorStore.getStore({ config });
  if (!store) {
    throw new Error(
      'AccountSelectorProviderMirror ERROR: primary store not initialized or removed',
    );
  }
  return (
    <AccountSelectorJotaiProvider store={store} config={config}>
      {children}
    </AccountSelectorJotaiProvider>
  );
}
