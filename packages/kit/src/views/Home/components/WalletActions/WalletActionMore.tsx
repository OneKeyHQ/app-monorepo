import type { ReactNode } from 'react';
import { useCallback } from 'react';

import { Divider } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useReviewControl } from '@onekeyhq/kit/src/components/ReviewControl';
import { getRewardCenterConfig } from '@onekeyhq/kit/src/components/RewardCenter';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { HomeTokenListProviderMirrorWrapper } from '../HomeTokenListProvider';

import { RawActions } from './RawActions';
import { useWalletActionConfig } from './useWalletActionConfig';
import { WalletActionBuy } from './WalletActionBuy';
import { WalletActionCopy } from './WalletActionCopy';
import { WalletActionExport } from './WalletActionExport';
import { WalletActionPerp } from './WalletActionPerp';
import { WalletActionRewardCenter } from './WalletActionRewardCenter';
import { WalletActionSell } from './WalletActionSell';
import { WalletActionSignAndVerify } from './WalletActionSignAndVerify';
import { WalletActionSwap } from './WalletActionSwap';
import { WalletActionViewInExplorer } from './WalletActionViewInExplorer';
import { WalletActionVote } from './WalletActionVote';

export function WalletActionMore() {
  const [devSettings] = useDevSettingsPersistAtom();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, network } = activeAccount;

  const show = useReviewControl();
  const { config, getMoreActionGroups, getActionCustomization } =
    useWalletActionConfig();

  const rewardCenterConfig = getRewardCenterConfig({
    accountId: account?.id ?? '',
    networkId: network?.id ?? '',
  });

  const vaultSettings = usePromiseResult(async () => {
    const settings = await backgroundApiProxy.serviceNetwork.getVaultSettings({
      networkId: network?.id ?? '',
    });
    return settings;
  }, [network?.id]).result;

  const displaySignAndVerify = usePromiseResult(async () => {
    return vaultSettings?.enabledInternalSignAndVerify;
  }, [vaultSettings]);

  const renderItemsAsync = useCallback(
    async ({
      handleActionListClose,
    }: {
      handleActionListClose: () => void;
    }) => {
      const groups = getMoreActionGroups();
      const elements: ReactNode[] = [];

      const renderTradingGroup = () => {
        const tradingGroup = groups.find((group) => group.type === 'trading');
        if (!tradingGroup) return null;

        const actions = tradingGroup.actions.filter((action) => {
          if (action === 'buy' || action === 'sell') {
            return show;
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
            case 'sell':
              return (
                <WalletActionSell key="sell" onClose={handleActionListClose} />
              );
            case 'swap':
              return platformEnv.isExtensionUiPopup ? (
                <WalletActionPerp
                  key="perp"
                  inList
                  onClose={handleActionListClose}
                />
              ) : (
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
              return !vaultSettings?.hideBlockExplorer;
            case 'copy':
              return !vaultSettings?.copyAddressDisabled;
            case 'sign':
              return displaySignAndVerify.result;
            case 'reward':
              return !!rewardCenterConfig;
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
              return devSettings?.settings?.showDevExportPrivateKey;
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
            sceneName: EAccountSelectorSceneName.home,
          }}
          enabledNum={[0]}
        >
          <HomeTokenListProviderMirrorWrapper
            accountId={activeAccount?.account?.id ?? ''}
          >
            {elements}
          </HomeTokenListProviderMirrorWrapper>
        </AccountSelectorProviderMirror>
      );
    },
    [
      getMoreActionGroups,
      activeAccount?.account?.id,
      config.moreActions,
      show,
      vaultSettings?.hideBlockExplorer,
      vaultSettings?.copyAddressDisabled,
      displaySignAndVerify.result,
      rewardCenterConfig,
      getActionCustomization,
      devSettings?.settings?.showDevExportPrivateKey,
    ],
  );

  return <RawActions.More renderItemsAsync={renderItemsAsync} />;
}
