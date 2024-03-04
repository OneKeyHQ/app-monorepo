import {
  useAccountSelectorContextData,
  useSelectedAccount,
} from '../../../states/jotai/contexts/accountSelector';
import { DeriveTypeSelectorTrigger } from '../DeriveTypeSelectorTrigger';
import { NetworkSelectorTriggerLegacy } from '../NetworkSelectorTrigger';

import { AccountSelectorTriggerBase } from './AccountSelectorTriggerBase';

function AccountSelectorTriggerSwapNetworkSelector({ num }: { num: number }) {
  const contextData = useAccountSelectorContextData();
  const {
    selectedAccount: { networkId },
  } = useSelectedAccount({ num });

  const { config } = contextData;

  return (
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
  );
}

export function AccountSelectorTriggerSwap({
  num,
  showNetworkSelector,
}: {
  num: number;
  showNetworkSelector?: boolean;
}) {
  return (
    <>
      <AccountSelectorTriggerBase num={num} linkNetwork />
      {showNetworkSelector ? (
        <AccountSelectorTriggerSwapNetworkSelector num={num} />
      ) : null}
    </>
  );
}
