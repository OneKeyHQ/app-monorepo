import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

import { AccountSelectorTriggerBase } from './AccountSelectorTriggerBase';

import type { ISpotlightViewProps } from '../../Spotlight';

export function AccountSelectorTriggerHome({
  num,
  spotlightProps,
  linkNetworkId,
  hideAddress,
}: {
  num: number;
  spotlightProps?: ISpotlightViewProps;
  linkNetworkId?: string;
  hideAddress?: boolean;
}) {
  const {
    activeAccount: { network, vaultSettings },
  } = useActiveAccount({
    num,
  });
  const resolvedLinkNetworkId =
    linkNetworkId ?? (!network?.isAllNetworks ? network?.id : undefined);

  return (
    <AccountSelectorTriggerBase
      horizontalLayout
      editable
      autoWidthForHome
      showWalletAvatar
      showWalletName={false}
      num={num}
      linkNetwork={!network?.isAllNetworks}
      hideAddress={hideAddress ?? vaultSettings?.mergeDeriveAssetsEnabled}
      linkNetworkId={resolvedLinkNetworkId}
      keepAllOtherAccounts
      allowSelectEmptyAccount
      spotlightProps={spotlightProps}
      showConnectWalletModalInDappMode
    />
  );
}
