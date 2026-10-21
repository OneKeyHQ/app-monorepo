import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import { Page } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  type EModalStakingRoutes,
  type IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { type ISupportedSymbol } from '@onekeyhq/shared/types/earn';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { EarnProviderMirror } from '../../../Earn/EarnProviderMirror';
import {
  EarnOfferSwitcher,
  EarnOffersDeposit,
} from '../../../Earn/pages/EarnRouter/EarnOffersDeposit';
import {
  findOffer,
  pickBetterOffer,
} from '../../../Earn/pages/EarnRouter/earnRouter.utils';
import { useEarnRouterOffers } from '../../../Earn/pages/EarnRouter/EarnRouterOffer';
import { EarnWithdrawDone } from '../../../Earn/pages/EarnRouter/EarnWithdrawDone';

import { HeaderRightView } from './components/HeaderRight';
import {
  type IManagePositionPayWith,
  type IManagePositionProtocolSwitchConfig,
  ManagePositionContent,
} from './components/ManagePositionContent';

import type { IHeaderRightViewProps } from './components/HeaderRight';

type ISelectedProtocol = {
  networkId: string;
  provider: string;
  vault?: string;
};

// Every deposit here can be paid with another token the wallet holds
const PAY_WITH: IManagePositionPayWith = {};

function getProtocolKey(protocol: ISelectedProtocol) {
  return `${protocol.provider.toLowerCase()}-${protocol.networkId}-${protocol.vault ?? ''}`;
}

function createSelectedProtocolFromItem(
  item: IStakeProtocolListItem,
): ISelectedProtocol {
  return {
    networkId: item.network.networkId,
    provider: item.provider.name,
    vault: earnUtils.shouldSendEarnProtocolVault({
      providerName: item.provider.name,
    })
      ? item.provider.vault
      : undefined,
  };
}

function getProtocolItemKey(item: IStakeProtocolListItem) {
  return getProtocolKey(createSelectedProtocolFromItem(item));
}

const ManagePositionPage = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.ManagePosition
  >();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { selectedAccount } = useSelectedAccount({ num: 0 });

  const resolvedParams = useMemo<{
    accountId: string;
    indexedAccountId: string | undefined;
    symbol: ISupportedSymbol;
    tokenImageUri: string | undefined;
    enableProtocolSwitch: boolean;
    initialProtocol: ISelectedProtocol;
    initialTab: 'deposit' | 'withdraw';
    // The one side shown, when the entry named it
    side: 'deposit' | 'withdraw' | undefined;
    onStakeWithdrawSuccess: (() => void) | undefined;
  }>(() => {
    const {
      networkId,
      symbol,
      provider,
      vault,
      tokenImageUri,
      enableProtocolSwitch,
      tab,
      onStakeWithdrawSuccess,
    } = route.params;

    return {
      accountId: selectedAccount.othersWalletAccountId || '',
      indexedAccountId:
        selectedAccount.indexedAccountId || activeAccount.indexedAccount?.id,
      symbol: symbol as ISupportedSymbol,
      tokenImageUri,
      enableProtocolSwitch: !!enableProtocolSwitch,
      initialProtocol: {
        networkId,
        provider,
        vault,
      },
      initialTab: tab ?? 'deposit',
      side: tab,
      onStakeWithdrawSuccess,
    };
  }, [activeAccount, route.params, selectedAccount]);

  const initialProtocolKey = useMemo(
    () => getProtocolKey(resolvedParams.initialProtocol),
    [resolvedParams.initialProtocol],
  );
  const initialProtocolKeyRef = useRef(initialProtocolKey);
  const [selectedProtocol, setSelectedProtocol] = useState<ISelectedProtocol>(
    resolvedParams.initialProtocol,
  );
  const [selectedTab, setSelectedTab] = useState<'deposit' | 'withdraw'>(
    resolvedParams.initialTab,
  );

  useEffect(() => {
    if (initialProtocolKeyRef.current !== initialProtocolKey) {
      initialProtocolKeyRef.current = initialProtocolKey;
      setSelectedProtocol(resolvedParams.initialProtocol);
    }
  }, [initialProtocolKey, resolvedParams.initialProtocol]);

  useEffect(() => {
    setSelectedTab(resolvedParams.initialTab);
  }, [initialProtocolKey, resolvedParams.initialTab]);

  const {
    accountId,
    indexedAccountId,
    symbol,
    tokenImageUri,
    enableProtocolSwitch,
    side,
    onStakeWithdrawSuccess,
  } = resolvedParams;

  const navigation = useAppNavigation();
  // Opened for the token's offers on a network (a home row), or switched to
  // them by a withdrawal's better rate
  const [offersEntry, setOffersEntry] = useState<
    { offerKey?: string; amount?: string; tokenImageUri?: string } | undefined
  >(route.params.earnOffers);
  // A form showing one side hands its History and quote controls up here,
  // for the modal's header
  const [headerControls, setHeaderControls] =
    useState<IHeaderRightViewProps | null>(null);
  // The token's offers on this network, for a modal opened on one side of a
  // position: its own offer names the protocol under the amount box, and a
  // withdrawal checks them for a better rate. Read while the form is open,
  // so the better rate is there the moment the withdrawal goes out
  const { offers: networkOffers, isLoaded: isNetworkOffersLoaded } =
    useEarnRouterOffers({
      symbol,
      networkId: selectedProtocol.networkId,
      enabled: Boolean(side) && !offersEntry,
    });
  const positionOffer = useMemo(
    () =>
      isNetworkOffersLoaded
        ? findOffer({
            offers: networkOffers,
            provider: selectedProtocol.provider,
            vault: selectedProtocol.vault,
          })
        : undefined,
    [
      isNetworkOffersLoaded,
      networkOffers,
      selectedProtocol.provider,
      selectedProtocol.vault,
    ],
  );
  // A withdrawal leaves the token in the wallet: if the same token earns
  // more elsewhere on this network, that offer shows once it is out
  const { from, better } = useMemo(
    () =>
      side === 'withdraw' && isNetworkOffersLoaded
        ? pickBetterOffer({
            offers: networkOffers,
            provider: selectedProtocol.provider,
            vault: selectedProtocol.vault,
          })
        : {},
    [
      isNetworkOffersLoaded,
      networkOffers,
      selectedProtocol.provider,
      selectedProtocol.vault,
      side,
    ],
  );
  const { result: network } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNetwork.getNetworkSafe({
        networkId: selectedProtocol.networkId,
      }),
    [selectedProtocol.networkId],
  );
  // One side of a position names its protocol as the token's offers modal
  // does, with the rate in it, so the card above the button needn't
  const positionRow = positionOffer ? (
    <EarnOfferSwitcher
      offers={[positionOffer]}
      selected={positionOffer}
      networkLogoURI={network?.logoURI}
    />
  ) : undefined;
  const [withdrawn, setWithdrawn] = useState<{
    amount: string;
    tokenImageUri?: string;
    offer: NonNullable<typeof better>;
    fromOffer?: typeof from;
  }>();
  const handleWithdrawn = useCallback(
    (info: { amount: string; tokenImageUri?: string }) => {
      if (!better || !new BigNumber(info.amount).gt(0)) {
        navigation.popStack();
        return;
      }
      setWithdrawn({ ...info, offer: better, fromOffer: from });
    },
    [better, from, navigation],
  );
  // The better rate opens here, in this modal, with what was withdrawn
  const handleDepositBetter = useCallback(() => {
    if (!withdrawn) {
      return;
    }
    setOffersEntry({
      offerKey: withdrawn.offer.key,
      amount: withdrawn.amount,
      tokenImageUri: withdrawn.tokenImageUri,
    });
    setWithdrawn(undefined);
  }, [withdrawn]);

  const { result: protocols, isLoading: isProtocolListLoading } =
    usePromiseResult(
      async () => {
        // Protocol switching is symbol-based and can still work for HD/HW
        // accounts where only indexedAccountId is available.
        if (!enableProtocolSwitch) {
          return [];
        }

        return backgroundApiProxy.serviceStaking.getProtocolList({
          symbol,
          accountId,
          indexedAccountId,
        });
      },
      [accountId, enableProtocolSwitch, indexedAccountId, symbol],
      {
        initResult: [],
        watchLoading: true,
      },
    );

  const currentProtocol = useMemo(
    () =>
      protocols.find(
        (item) => getProtocolItemKey(item) === getProtocolKey(selectedProtocol),
      ),
    [protocols, selectedProtocol],
  );

  const handleProtocolSelect = useCallback(
    (protocol: IStakeProtocolListItem) => {
      const nextProtocol = createSelectedProtocolFromItem(protocol);

      setSelectedProtocol((currentSelection) => {
        if (getProtocolKey(currentSelection) === getProtocolKey(nextProtocol)) {
          return currentSelection;
        }

        return nextProtocol;
      });
    },
    [],
  );

  const stakeProtocolSwitchConfig = useMemo<
    IManagePositionProtocolSwitchConfig | undefined
  >(() => {
    if (!enableProtocolSwitch) {
      return undefined;
    }

    return {
      currentProtocol,
      indexedAccountId,
      isLoading: isProtocolListLoading,
      protocols,
      selectedProtocol,
      onProtocolSelect: handleProtocolSelect,
    };
  }, [
    currentProtocol,
    enableProtocolSwitch,
    handleProtocolSelect,
    indexedAccountId,
    isProtocolListLoading,
    protocols,
    selectedProtocol,
  ]);

  let body: ReactNode;
  if (offersEntry) {
    body = (
      <EarnOffersDeposit
        symbol={symbol}
        networkId={selectedProtocol.networkId}
        logoURI={offersEntry.tokenImageUri ?? tokenImageUri}
        offerKey={offersEntry.offerKey}
        amount={offersEntry.amount}
        onHeaderRightChange={setHeaderControls}
      />
    );
  } else if (withdrawn) {
    body = (
      <EarnWithdrawDone
        symbol={symbol}
        tokenImageUri={withdrawn.tokenImageUri ?? tokenImageUri}
        amount={withdrawn.amount}
        offer={withdrawn.offer}
        fromOffer={withdrawn.fromOffer}
        onDone={() => navigation.popStack()}
        onDeposit={handleDepositBetter}
      />
    );
  } else {
    body = (
      // No key remount on protocol switch: useManagePage keeps stale data
      // while refetching, so the switcher / trade-or-buy / input stay put
      // and only the changed values update — no full skeleton flash on
      // switch.
      <ManagePositionContent
        showApyDetail={!positionRow}
        isInModalContext
        networkId={selectedProtocol.networkId}
        symbol={symbol}
        provider={selectedProtocol.provider}
        vault={selectedProtocol.vault}
        accountId={accountId}
        indexedAccountId={indexedAccountId}
        fallbackTokenImageUri={tokenImageUri}
        defaultTab={selectedTab}
        onTabChange={setSelectedTab}
        depositOnly={side === 'deposit'}
        withdrawOnly={side === 'withdraw'}
        payWith={side === 'withdraw' ? undefined : PAY_WITH}
        stakeProtocolSwitchConfig={stakeProtocolSwitchConfig}
        onStakeWithdrawSuccess={onStakeWithdrawSuccess}
        onWithdrawn={better ? handleWithdrawn : undefined}
        onHeaderRightChange={setHeaderControls}
        offerSwitch={positionRow}
      />
    );
  }

  return (
    <Page scrollEnabled scrollProps={{ keyboardShouldPersistTaps: 'handled' }}>
      <Page.Header
        title={symbol}
        headerRight={
          headerControls
            ? () => <HeaderRightView {...headerControls} />
            : undefined
        }
      />
      <Page.Body>{body}</Page.Body>
    </Page>
  );
};

function ManagePositionPageWithProvider() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <DiscoveryBrowserProviderMirror>
          <ManagePositionPage />
        </DiscoveryBrowserProviderMirror>
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

export default ManagePositionPageWithProvider;
