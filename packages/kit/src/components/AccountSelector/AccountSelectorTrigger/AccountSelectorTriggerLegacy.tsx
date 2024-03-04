import { useCallback } from 'react';

import { Button } from '@onekeyhq/components';

import {
  useAccountSelectorContextData,
  useSelectedAccount,
} from '../../../states/jotai/contexts/accountSelector';
import { DeriveTypeSelectorTrigger } from '../DeriveTypeSelectorTrigger';
import { NetworkSelectorTriggerLegacy } from '../NetworkSelectorTrigger';

export function AccountSelectorTriggerLegacy({
  num,
  onlyAccountSelector,
}: {
  num: number;
  onlyAccountSelector?: boolean;
}) {
  const contextData = useAccountSelectorContextData();
  const {
    selectedAccount: { networkId },
  } = useSelectedAccount({ num });

  const { config } = contextData;
  const title = `${config?.sceneName || ''} 账户选择器 🔗  ${num}`;
  const showAccountSelector = useCallback(() => {
    throw new Error('showAccountSelector legacy not implemented');
  }, []);
  return (
    <>
      <Button onPress={showAccountSelector}>{title}</Button>

      {!onlyAccountSelector ? (
        <>
          <NetworkSelectorTriggerLegacy
            key={`NetworkSelectorTrigger-${networkId || ''}-${num}-${
              config?.sceneName || ''
            }`}
            num={num}
          />
          <DeriveTypeSelectorTrigger
            key={`DeriveTypeSelectorTrigger-${networkId || ''}-${num}-${
              config?.sceneName || ''
            }`}
            num={num}
          />
        </>
      ) : null}
    </>
  );
}
