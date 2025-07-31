import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

import { AccountSelectorTriggerBase } from './AccountSelectorTriggerBase';

import type { ISpotlightViewProps } from '../../Spotlight';

export function AccountSelectorTriggerHome({
  num,
  spotlightProps,
}: {
  num: number;
  spotlightProps?: ISpotlightViewProps;
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
      linkNetwork={
        !(network?.isAllNetworks || vaultSettings?.mergeDeriveAssetsEnabled)
      }
      keepAllOtherAccounts
      allowSelectEmptyAccount
      spotlightProps={spotlightProps}
    />
  );
}
