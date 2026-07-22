import { useCallback, useEffect, useRef } from 'react';

import { rootNavigationRef } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useWalletBanner } from '@onekeyhq/kit/src/hooks/useWalletBanner';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useHomeInteraction,
  useHomeResource,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import {
  settingsValuePersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EModalAssetDetailRoutes,
  EModalRoutes,
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { maybeOpenPrivateSendHistoryDetail } from '../../../Swap/utils/privateSendHistory';
import {
  HOME_BANNER_ACTION_IDS,
  fromHomeBannerStoreItem,
  readHomeBannerStorePayload,
} from '../sections/banner/homeBannerStoreModel';
import { getHomeMarketTokenRowId } from '../sections/market/homeMarketSourceAdapter';
import { getHomeNFTItemRowId } from '../sections/nft/homeNFTSourceAdapter';
import {
  HOME_SECTION_ACTION_IDS,
  HOME_SHELL_ACTION_IDS,
} from '../store/homeStoreCommandIds';

import {
  executeHomePerpsOpenAsset,
  resolveHomePerpsOpenAssetCommand,
} from './homePerpsActionExecutor';
import {
  useHomeSectionPayload,
  useStableHomeFactsOwner,
} from './homeStoreHooks';
import { useHomeStoreControllerActions } from './useHomeStoreControllerActions';

import type {
  IHomeStorePendingSectionCommand,
  IHomeStorePendingShellCommand,
} from '../store/homeStoreTypes';

const SHELL_COMMANDS = new Set<string>([
  ...Object.values(HOME_SHELL_ACTION_IDS),
  HOME_BANNER_ACTION_IDS.open,
]);
const SECTION_COMMANDS = new Set<string>(
  Object.values(HOME_SECTION_ACTION_IDS),
);

export function HomeStoreCommandController() {
  const navigation = useAppNavigation();
  const interaction = useHomeInteraction();
  const stableOwner = useStableHomeFactsOwner();
  const stableOwnerRef = useRef(stableOwner);
  stableOwnerRef.current = stableOwner;
  const { markHomeSectionCommandHandled } = useHomeStoreControllerActions();
  const processingCommandIdsRef = useRef(new Set<string>());
  const deferredCommandTimersRef = useRef(
    new Set<ReturnType<typeof setTimeout>>(),
  );
  const {
    activeAccount: { account, indexedAccount, network, wallet },
  } = useActiveAccount({ num: 0 });
  const [settings] = useSettingsPersistAtom();
  const { handleBannerOnPress } = useWalletBanner({ account, network, wallet });
  const portfolioPayload = useHomeSectionPayload('portfolio');
  const perpsPayload = useHomeSectionPayload('perps');
  const defiPayload = useHomeSectionPayload('defi');
  const nftPayload = useHomeSectionPayload('nft');
  const historyPayload = useHomeSectionPayload('history');
  const marketPayload = useHomeSectionPayload('market');
  const bannerResource = useHomeResource('banner');
  const bannerPayload =
    bannerResource.kind === 'ready'
      ? readHomeBannerStorePayload(bannerResource.data)
      : undefined;

  const isCommandCurrent = useCallback(
    (
      command: IHomeStorePendingSectionCommand | IHomeStorePendingShellCommand,
    ) => {
      const current = stableOwnerRef.current;
      return Boolean(
        current &&
        current.ownerToken.sessionId === command.sessionId &&
        stringUtils.stableStringify(current.owner) ===
          stringUtils.stableStringify(command.owner),
      );
    },
    [],
  );

  const scheduleDeferredCommand = useCallback(
    ({
      callback,
      command,
      delayMs,
    }: {
      callback: () => void;
      command: IHomeStorePendingSectionCommand | IHomeStorePendingShellCommand;
      delayMs: number;
    }) => {
      const timeoutId = setTimeout(() => {
        deferredCommandTimersRef.current.delete(timeoutId);
        if (isCommandCurrent(command)) {
          callback();
        }
      }, delayMs);
      deferredCommandTimersRef.current.add(timeoutId);
    },
    [isCommandCurrent],
  );

  useEffect(
    () => () => {
      deferredCommandTimersRef.current.forEach((timeoutId) =>
        clearTimeout(timeoutId),
      );
      deferredCommandTimersRef.current.clear();
    },
    [stableOwner?.ownerToken.scopeKey, stableOwner?.ownerToken.sessionId],
  );

  const executeShellCommand = useCallback(
    async (command: IHomeStorePendingShellCommand) => {
      if (!isCommandCurrent(command)) {
        return;
      }
      if (command.actionId === HOME_SHELL_ACTION_IDS.balance) {
        const value = await settingsValuePersistAtom.get();
        await settingsValuePersistAtom.set({ hideValue: !value.hideValue });
        return;
      }
      if (command.actionId === HOME_BANNER_ACTION_IDS.open) {
        const item = bannerPayload?.banners.find(
          (candidate) => candidate.id === command.itemId,
        );
        if (item) {
          await handleBannerOnPress(fromHomeBannerStoreItem(item));
        }
      }
    },
    [bannerPayload?.banners, handleBannerOnPress, isCommandCurrent],
  );

  const executeSectionCommand = useCallback(
    async (command: IHomeStorePendingSectionCommand) => {
      if (!isCommandCurrent(command)) {
        return;
      }
      if (
        command.actionId === HOME_SECTION_ACTION_IDS.openAsset &&
        account &&
        network &&
        wallet
      ) {
        const token = portfolioPayload?.tokens.find(
          (candidate) => candidate.$key === command.itemId,
        );
        if (token) {
          navigation.pushModal(EModalRoutes.MainModal, {
            screen: EModalAssetDetailRoutes.TokenDetails,
            params: {
              accountId: token.accountId ?? account.id,
              networkId: token.networkId ?? network.id,
              accountAddress: account.address ?? '',
              walletId: wallet.id,
              isAllNetworks: network.isAllNetworks,
              indexedAccountId: indexedAccount?.id ?? '',
              tokenInfo: token,
              aggregateTokens:
                portfolioPayload?.aggregateTokenListMap[token.$key]?.tokens ??
                [],
              tokenMap: portfolioPayload?.tapTokenMap ?? {},
            },
          });
        }
        return;
      }
      if (
        command.actionId === HOME_SECTION_ACTION_IDS.openNFT &&
        account &&
        network &&
        wallet
      ) {
        const nft = nftPayload?.data.find(
          (candidate) => getHomeNFTItemRowId(candidate) === command.itemId,
        );
        if (nft) {
          navigation.pushModal(EModalRoutes.MainModal, {
            screen: EModalAssetDetailRoutes.NFTDetails,
            params: {
              networkId: nft.networkId ?? network.id,
              accountId: nft.accountId ?? account.id,
              walletId: wallet.id,
              collectionAddress: nft.collectionAddress,
              itemId: nft.itemId,
            },
          });
        }
        return;
      }
      if (
        command.actionId === HOME_SECTION_ACTION_IDS.openDeFiProtocol &&
        account
      ) {
        const protocol = defiPayload?.protocols.find(
          (candidate) =>
            defiUtils.buildProtocolMapKey({
              networkId: candidate.networkId,
              protocol: candidate.protocol,
            }) === command.itemId,
        );
        if (protocol) {
          const protocolKey = defiUtils.buildProtocolMapKey({
            networkId: protocol.networkId,
            protocol: protocol.protocol,
          });
          navigation.pushModal(EModalRoutes.MainModal, {
            screen: EModalAssetDetailRoutes.DeFiProtocolDetails,
            params: {
              protocol,
              protocolInfo: defiPayload?.protocolMap[protocolKey],
              accountId: protocol.accountId ?? account.id,
              indexedAccountId: protocol.indexedAccountId ?? indexedAccount?.id,
              supportedActions: defiPayload?.supportedActions ?? [],
            },
          });
        }
        return;
      }
      if (command.actionId === HOME_SECTION_ACTION_IDS.openPerps) {
        const openAssetCommand = resolveHomePerpsOpenAssetCommand({
          itemId: command.itemId,
          payload: perpsPayload,
        });
        if (openAssetCommand) {
          await executeHomePerpsOpenAsset({
            accountIdentity: {
              accountId: account?.id,
              indexedAccountId: indexedAccount?.id,
              walletId: wallet?.id,
            },
            ...openAssetCommand,
            isCurrent: () => isCommandCurrent(command),
            scheduleDeferred: (callback, delayMs) =>
              scheduleDeferredCommand({ callback, command, delayMs }),
            switchToPerps: () => navigation.switchTab(ETabRoutes.Perp),
          });
        }
        return;
      }
      if (
        command.actionId === HOME_SECTION_ACTION_IDS.openHistory &&
        account &&
        network
      ) {
        const history = historyPayload?.data.find(
          (candidate) => candidate.id === command.itemId,
        );
        if (!history) {
          return;
        }
        if (
          history.decodedTx.status === EDecodedTxStatus.Pending &&
          history.isLocalCreated
        ) {
          const localTx =
            await backgroundApiProxy.serviceHistory.getLocalHistoryTxById({
              accountId: history.decodedTx.accountId,
              historyId: history.id,
              networkId: history.decodedTx.networkId,
            });
          if (
            !isCommandCurrent(command) ||
            !localTx ||
            localTx.replacedNextId
          ) {
            return;
          }
        }
        const openedPrivateSendHistory =
          await maybeOpenPrivateSendHistoryDetail({
            accountAddress: account.address,
            accountId: history.decodedTx.accountId,
            currencySymbol: settings.currencyInfo.symbol,
            historyTx: history,
            navigation,
            network,
          });
        if (!isCommandCurrent(command)) {
          return;
        }
        if (!openedPrivateSendHistory) {
          navigation.pushModal(EModalRoutes.MainModal, {
            screen: EModalAssetDetailRoutes.HistoryDetails,
            params: {
              accountId: history.decodedTx.accountId,
              historyTx: history,
              isAllNetworks: network.isAllNetworks,
              networkId: history.decodedTx.networkId,
            },
          });
        }
        return;
      }
      if (command.actionId === HOME_SECTION_ACTION_IDS.openMarket) {
        const token = marketPayload?.rows.find(
          (candidate) => getHomeMarketTokenRowId(candidate) === command.itemId,
        );
        if (!token) {
          return;
        }
        if (token.perpsCoin) {
          await executeHomePerpsOpenAsset({
            accountIdentity: {
              accountId: account?.id,
              indexedAccountId: indexedAccount?.id,
              walletId: wallet?.id,
            },
            coin: token.perpsCoin,
            isCurrent: () => isCommandCurrent(command),
            mode: 'perp',
            openMarket: false,
            scheduleDeferred: (callback, delayMs) =>
              scheduleDeferredCommand({ callback, command, delayMs }),
            switchToPerps: () => navigation.switchTab(ETabRoutes.Perp),
          });
          return;
        }
        const shortCode = networkUtils.getNetworkShortCode({
          networkId: token.chainId,
        });
        navigation.switchTab(ETabRoutes.Discovery);
        scheduleDeferredCommand({
          command,
          delayMs: 300,
          callback: () => {
            rootNavigationRef.current?.navigate(ERootRoutes.Main, {
              screen: ETabRoutes.Discovery,
              params: {
                screen: ETabMarketRoutes.MarketDetailV2,
                params: {
                  tokenAddress: token.contractAddress,
                  network: shortCode || token.chainId,
                  isNative: token.isNative,
                },
              },
            });
          },
        });
      }
    },
    [
      account,
      defiPayload,
      historyPayload?.data,
      indexedAccount?.id,
      isCommandCurrent,
      marketPayload?.rows,
      navigation,
      network,
      nftPayload?.data,
      perpsPayload,
      portfolioPayload,
      scheduleDeferredCommand,
      settings.currencyInfo.symbol,
      wallet,
    ],
  );

  useEffect(() => {
    if (!stableOwner) {
      return;
    }
    const commands = [
      ...interaction.pendingShellCommands.filter((command) =>
        SHELL_COMMANDS.has(command.actionId),
      ),
      ...interaction.pendingSectionCommands.filter((command) =>
        SECTION_COMMANDS.has(command.actionId),
      ),
    ];
    for (const command of commands) {
      if (!processingCommandIdsRef.current.has(command.intentId)) {
        processingCommandIdsRef.current.add(command.intentId);
        const run = async () => {
          try {
            if (command.type === 'headerActionInvoked') {
              await executeShellCommand(command);
            } else {
              await executeSectionCommand(command);
            }
          } catch {
            // The command is still consumed; feature executors own user feedback.
          } finally {
            processingCommandIdsRef.current.delete(command.intentId);
            const current = stableOwnerRef.current;
            if (current && isCommandCurrent(command)) {
              markHomeSectionCommandHandled({
                intentId: command.intentId,
                ownerToken: current.ownerToken,
              });
            }
          }
        };
        void run();
      }
    }
  }, [
    executeSectionCommand,
    executeShellCommand,
    interaction.pendingSectionCommands,
    interaction.pendingShellCommands,
    isCommandCurrent,
    markHomeSectionCommandHandled,
    stableOwner,
  ]);

  return null;
}
