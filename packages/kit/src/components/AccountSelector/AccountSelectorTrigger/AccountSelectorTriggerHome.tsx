import { Spinner } from '@onekeyhq/components';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import {
  useAccountSelectorSyncLoadingAtom,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';

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
    activeAccount: { network, vaultSettings, wallet, account },
  } = useActiveAccount({
    num,
  });
  const resolvedLinkNetworkId =
    linkNetworkId ?? (!network?.isAllNetworks ? network?.id : undefined);
  const [syncLoading] = useAccountSelectorSyncLoadingAtom();
  const isSyncLoading = syncLoading?.[num]?.isLoading;

  if (
    !wallet ||
    (accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' }) && !account)
  ) {
    if (isSyncLoading) {
      return <Spinner size="small" />;
    }
    return null;
  }

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
