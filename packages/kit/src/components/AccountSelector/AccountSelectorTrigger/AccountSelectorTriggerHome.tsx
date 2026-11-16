import { Spinner } from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import {
  useActiveAccount,
  useIsAccountSelectorSyncLoading,
} from '../../../states/jotai/contexts/accountSelector';

import { AccountSelectorTriggerBase } from './AccountSelectorTriggerBase';

import type { ISpotlightViewProps } from '../../Spotlight';

export function AccountSelectorTriggerHome({
  num,
  spotlightProps,
  linkNetworkId,
  hideAddress,
  desktopHeader,
  hideAvatar,
  containerProps,
}: {
  num: number;
  spotlightProps?: ISpotlightViewProps;
  linkNetworkId?: string;
  hideAddress?: boolean;
  desktopHeader?: boolean;
  hideAvatar?: boolean;
  containerProps?: IXStackProps;
}) {
  const {
    activeAccount: { network, vaultSettings, wallet, account },
  } = useActiveAccount({
    num,
  });
  const resolvedLinkNetworkId =
    linkNetworkId ?? (!network?.isAllNetworks ? network?.id : undefined);
  const isSyncLoading = useIsAccountSelectorSyncLoading(num);

  if (
    !platformEnv.isWebDappMode &&
    accountUtils.hasNoUsableWallet({ wallet, account })
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
      showWalletAvatar={!platformEnv.isWebDappMode}
      showWalletName={false}
      num={num}
      linkNetwork={!network?.isAllNetworks}
      hideAddress={hideAddress ?? vaultSettings?.mergeDeriveAssetsEnabled}
      linkNetworkId={resolvedLinkNetworkId}
      keepAllOtherAccounts
      allowSelectEmptyAccount
      spotlightProps={spotlightProps}
      showConnectWalletModalInDappMode
      desktopHeader={desktopHeader}
      hideAvatar={hideAvatar}
      containerProps={containerProps}
    />
  );
}
