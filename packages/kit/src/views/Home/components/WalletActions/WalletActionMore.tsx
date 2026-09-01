import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';

import { Divider } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useReviewControl } from '@onekeyhq/kit/src/components/ReviewControl';
import { getRewardCenterConfig } from '@onekeyhq/kit/src/components/RewardCenter';
import { useBotWalletDeactivatedStatus } from '@onekeyhq/kit/src/hooks/useBotWalletDeactivatedStatus';
import {
  useAccountSelectorSceneInfo,
  useActiveAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { shouldHideBotWalletExport } from '@onekeyhq/kit/src/utils/botWalletStatusUtils';
import {
  useDevSettingsPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IVaultSettings } from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworksSupportBulkRevokeApproval } from '@onekeyhq/shared/src/config/presetNetworks';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { HomeTestIDs } from '../../testIDs';
import { HomeTokenListProviderMirrorWrapper } from '../HomeTokenListProvider';

import { RawActions } from './RawActions';
import { useWalletActionConfig } from './useWalletActionConfig';
import { WalletActionAddressList } from './WalletActionAddressList';
import { WalletActionApprovals } from './WalletActionApprovals';
import { WalletActionBulkSend } from './WalletActionBulkSend';
import { WalletActionBuy } from './WalletActionBuy';
import { WalletActionCoins } from './WalletActionCoins';
import { WalletActionCopy } from './WalletActionCopy';
import { WalletActionExport } from './WalletActionExport';
import { WalletActionRewardCenter } from './WalletActionRewardCenter';
import { WalletActionSignAndVerify } from './WalletActionSignAndVerify';
import { WalletActionSwap } from './WalletActionSwap';
import { WalletActionViewInExplorer } from './WalletActionViewInExplorer';
import { WalletActionVote } from './WalletActionVote';

type IRenderMoreItemsParams = {
  handleActionListClose: () => void;
  resolvedVaultSettings?: IVaultSettings;
  resolvedIsBotWalletDeactivated?: boolean;
};

export function WalletActionMore({ iconOnly }: { iconOnly?: boolean } = {}) {
  const [devSettings] = useDevSettingsPersistAtom();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { sceneName, sceneUrl } = useAccountSelectorSceneInfo();
  const { account, network } = activeAccount;

  const show = useReviewControl();
  const { config, getMoreActionGroups, getActionCustomization, vaultSettings } =
    useWalletActionConfig();

  const [{ enableBTCFreshAddress }] = useSettingsPersistAtom();
  const isAddressListEnabled = useMemo(
    () =>
      Boolean(account?.id) &&
      Boolean(network?.id) &&
      Boolean(activeAccount?.wallet?.id) &&
      accountUtils.isEnabledBtcFreshAddress({
        enableBTCFreshAddress,
        networkId: network?.id,
        walletId: activeAccount?.wallet?.id,
      }),
    [
      account?.id,
      network?.id,
      activeAccount?.wallet?.id,
      enableBTCFreshAddress,
    ],
  );

  const rewardCenterConfig = useMemo(
    () =>
      getRewardCenterConfig({
        accountId: account?.id ?? '',
        networkId: network?.id ?? '',
      }),
    [account?.id, network?.id],
  );

  const { isBotWallet, isBotWalletDeactivated } = useBotWalletDeactivatedStatus(
    {
      walletId: activeAccount?.wallet?.id,
    },
  );

  const isApprovalEnabled = useMemo(() => {
    const networksSupportApproval = getNetworksSupportBulkRevokeApproval();
    if (network?.isAllNetworks) {
      if (
        accountUtils.isOthersAccount({
          accountId: account?.id ?? '',
        })
      ) {
        return networkUtils.isEvmNetwork({
          networkId: account?.createAtNetwork ?? '',
        });
      }
      return true;
    }
    return networksSupportApproval[network?.id ?? ''] ?? false;
  }, [
    network?.isAllNetworks,
    network?.id,
    account?.id,
    account?.createAtNetwork,
  ]);

  const renderItems = useCallback(
    ({
      handleActionListClose,
      resolvedVaultSettings = vaultSettings,
      resolvedIsBotWalletDeactivated = isBotWalletDeactivated,
    }: IRenderMoreItemsParams) => {
      const groups = getMoreActionGroups();
      const elements: ReactNode[] = [];
      const resolvedIsCoinsEnabled =
        Boolean(account?.id) &&
        Boolean(network?.id) &&
        Boolean(activeAccount?.wallet?.id) &&
        Boolean(resolvedVaultSettings?.coinControlEnabled);

      const renderTradingGroup = () => {
        const tradingGroup = groups.find((group) => group.type === 'trading');
        if (!tradingGroup) return null;

        const actions = tradingGroup.actions.filter((action) => {
          if (action === 'buy') {
            return show;
          }
          if (action === 'swap' && resolvedVaultSettings?.disabledSwapAction) {
            return false;
          }
          return config.moreActions.includes(action);
        });

        if (actions.length === 0) return null;

        return actions.map((action) => {
          switch (action) {
            case 'buy':
              return (
                <WalletActionBuy key="buy" onClose={handleActionListClose} />
              );
            case 'swap':
              return (
                <WalletActionSwap
                  key="swap"
                  onClose={handleActionListClose}
                  inList
                />
              );
            default:
              return null;
          }
        });
      };

      const renderToolsGroup = () => {
        const toolsGroup = groups.find((group) => group.type === 'tools');
        if (!toolsGroup) return [];

        const actions = toolsGroup.actions.filter((action) => {
          switch (action) {
            case 'explorer':
              return !resolvedVaultSettings?.hideBlockExplorer;
            case 'copy':
              return !resolvedVaultSettings?.copyAddressDisabled;
            case 'sign':
              return resolvedVaultSettings?.enabledInternalSignAndVerify;
            case 'reward':
              return !!rewardCenterConfig;
            case 'approvals':
              return isApprovalEnabled;
            case 'addressList':
              return isAddressListEnabled;
            case 'coins':
              return resolvedIsCoinsEnabled;
            default:
              return config.moreActions.includes(action);
          }
        });

        if (actions.length === 0) return [];

        return actions.map((action) => {
          switch (action) {
            case 'explorer':
              return (
                <WalletActionViewInExplorer
                  key="explorer"
                  onClose={handleActionListClose}
                />
              );
            case 'copy':
              return (
                <WalletActionCopy key="copy" onClose={handleActionListClose} />
              );
            case 'addressList':
              return (
                <WalletActionAddressList
                  key="addressList"
                  onClose={handleActionListClose}
                />
              );
            case 'coins':
              return (
                <WalletActionCoins
                  key="coins"
                  onClose={handleActionListClose}
                />
              );
            case 'bulkSend':
              return (
                <WalletActionBulkSend
                  key="bulkSend"
                  onClose={handleActionListClose}
                />
              );
            case 'sign':
              return (
                <WalletActionSignAndVerify
                  key="sign"
                  onClose={handleActionListClose}
                />
              );
            case 'reward':
              return rewardCenterConfig ? (
                <WalletActionRewardCenter
                  key="reward"
                  onClose={handleActionListClose}
                  rewardCenterConfig={rewardCenterConfig}
                />
              ) : null;
            case 'approvals':
              return (
                <WalletActionApprovals
                  key="approvals"
                  onClose={handleActionListClose}
                />
              );
            case 'vote':
              return (
                <WalletActionVote
                  key="vote"
                  onClose={handleActionListClose}
                  customization={getActionCustomization('vote')}
                />
              );
            default:
              return null;
          }
        });
      };

      const renderDeveloperGroup = () => {
        const developerGroup = groups.find(
          (group) => group.type === 'developer',
        );
        if (!developerGroup) return [];

        const actions = developerGroup.actions.filter((action) => {
          switch (action) {
            case 'export':
              return (
                devSettings?.settings?.showDevExportPrivateKey &&
                !shouldHideBotWalletExport({
                  isBotWallet,
                  isBotWalletDeactivated: resolvedIsBotWalletDeactivated,
                })
              );
            default:
              return config.moreActions.includes(action);
          }
        });

        if (actions.length === 0) return [];

        return actions.map((action) => {
          switch (action) {
            case 'export':
              return (
                <WalletActionExport
                  key="export"
                  onClose={handleActionListClose}
                />
              );
            default:
              return null;
          }
        });
      };

      const tradingElements = renderTradingGroup();
      if (tradingElements && tradingElements.length > 0) {
        elements.push(...tradingElements);
      }

      const toolsElements = renderToolsGroup();
      if (toolsElements.length > 0) {
        if (elements.length > 0) {
          elements.push(<Divider key="divider-1" mx="$2" my="$1" />);
        }
        elements.push(...toolsElements);
      }

      const devElements = renderDeveloperGroup();
      if (devElements.length > 0) {
        if (elements.length > 0) {
          elements.push(<Divider key="divider-2" mx="$2" my="$1" />);
        }
        elements.push(...devElements);
      }

      return (
        <AccountSelectorProviderMirror
          config={{
            sceneName,
            sceneUrl,
          }}
          enabledNum={[0]}
        >
          <HomeTokenListProviderMirrorWrapper accountId={account?.id ?? ''}>
            {elements}
          </HomeTokenListProviderMirrorWrapper>
        </AccountSelectorProviderMirror>
      );
    },
    [
      getMoreActionGroups,
      account?.id,
      activeAccount?.wallet?.id,
      network?.id,
      config.moreActions,
      show,
      vaultSettings,
      rewardCenterConfig,
      isApprovalEnabled,
      isAddressListEnabled,
      getActionCustomization,
      devSettings?.settings?.showDevExportPrivateKey,
      isBotWallet,
      isBotWalletDeactivated,
      sceneName,
      sceneUrl,
    ],
  );

  const renderItemsAsync = useCallback(
    async ({
      handleActionListClose,
    }: {
      handleActionListClose: () => void;
    }) => {
      const walletId = activeAccount?.wallet?.id;
      const [resolvedVaultSettings, resolvedIsBotWalletDeactivated] =
        await Promise.all([
          network?.id
            ? backgroundApiProxy.serviceNetwork.getVaultSettings({
                networkId: network.id,
              })
            : Promise.resolve(vaultSettings),
          isBotWallet && walletId
            ? backgroundApiProxy.serviceAccount.isBotWalletDeactivated({
                walletId,
              })
            : Promise.resolve(isBotWalletDeactivated),
        ]);

      return renderItems({
        handleActionListClose,
        resolvedVaultSettings,
        resolvedIsBotWalletDeactivated,
      });
    },
    [
      activeAccount?.wallet?.id,
      isBotWallet,
      isBotWalletDeactivated,
      network?.id,
      renderItems,
      vaultSettings,
    ],
  );

  return (
    <RawActions.More
      renderItems={renderItems}
      renderItemsAsync={renderItemsAsync}
      testID={HomeTestIDs.moreButton}
      iconOnly={iconOnly}
    />
  );
}
