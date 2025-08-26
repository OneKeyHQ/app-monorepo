import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

import { AccountSelectorTriggerBase } from './AccountSelectorTriggerBase';

import type { ISpotlightViewProps } from '../../Spotlight';

export function AccountSelectorTriggerHome({
  num,
  spotlightProps,
  linkNetworkId,
}: {
  num: number;
  spotlightProps?: ISpotlightViewProps;
  linkNetworkId?: string;
}) {
  const {
    activeAccount: { network, vaultSettings },
  } = useActiveAccount({
    num,
  });

  return (
    <AccountSelectorTriggerBase
      horizontalLayout
      editable
      autoWidthForHome
      showWalletAvatar
      showWalletName={false}
      num={num}
      linkNetwork={!network?.isAllNetworks}
      hideAddress={vaultSettings?.mergeDeriveAssetsEnabled}
      linkNetworkId={linkNetworkId}
      keepAllOtherAccounts
      allowSelectEmptyAccount
      spotlightProps={spotlightProps}
      showConnectWalletModalInDappMode
    />
  );
}
