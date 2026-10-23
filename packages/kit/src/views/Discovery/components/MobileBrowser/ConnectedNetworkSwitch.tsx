import { useEffect } from 'react';

import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useNetworkSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useNetworkSelectorTrigger';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IConnectionAccountInfoWithNum } from '@onekeyhq/shared/types/dappConnection';

type ISwitchNetworkHandler = (() => void) | undefined;

function NetworkSwitchBridge({
  num,
  onChange,
}: {
  num: number;
  onChange: (handler: ISwitchNetworkHandler) => void;
}) {
  const { networkIds, showChainSelector } = useNetworkSelectorTrigger({ num });
  const canSwitch = (networkIds ?? []).length > 1;
  useEffect(() => {
    onChange(
      canSwitch
        ? () => showChainSelector({ recordNetworkHistoryEnabled: true })
        : undefined,
    );
    return () => onChange(undefined);
  }, [canSwitch, showChainSelector, onChange]);
  return null;
}

// Headless: exposes the network switch for a site's single connected account
// (in the same dApp account-selector scene as the header chip, which persists
// the change to the connection) so the bottom bar menu can offer it. Reports
// nothing when the site supports only one network.
export function ConnectedNetworkSwitch({
  origin,
  account,
  onChange,
}: {
  origin: string;
  account: IConnectionAccountInfoWithNum;
  onChange: (handler: ISwitchNetworkHandler) => void;
}) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.discover,
        sceneUrl: origin,
      }}
      enabledNum={[account.num]}
      availableNetworksMap={{
        [account.num]: { networkIds: account.availableNetworkIds },
      }}
    >
      <NetworkSwitchBridge num={account.num} onChange={onChange} />
    </AccountSelectorProviderMirror>
  );
}
