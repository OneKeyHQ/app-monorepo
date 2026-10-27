import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useReducedMotion } from 'react-native-reanimated';

import { Page, YStack } from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  type EModalStakingRoutes,
  type IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { type ISupportedSymbol } from '@onekeyhq/shared/types/earn';
import { getEarnProviderDisplayName } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { EarnProviderMirror } from '../../../Earn/EarnProviderMirror';
import { EarnNavigation } from '../../../Earn/earnUtils';
import { EarnDepositDone } from '../../../Earn/pages/EarnRouter/EarnDepositDone';
import {
  EarnOfferSwitcher,
  EarnOffersDeposit,
} from '../../../Earn/pages/EarnRouter/EarnOffersDeposit';
import {
  findOffer,
  pickBetterOffer,
} from '../../../Earn/pages/EarnRouter/earnRouter.utils';
import {
  getOfferTarget,
  useEarnRouterOffers,
} from '../../../Earn/pages/EarnRouter/EarnRouterOffer';
import { EarnWithdrawDone } from '../../../Earn/pages/EarnRouter/EarnWithdrawDone';
import { EarnFormLeavingContext } from '../../components/EarnFooterFade';
import { EarnOutcomeCarryContext } from '../../components/UniversalStake/EarnFormSummary';
import { useFitModalHeight } from '../../hooks/useFitModalHeight';

import { HeaderRightView } from './components/HeaderRight';
import {
  type IManagePositionPayWith,
  type IManagePositionProtocolSwitchConfig,
  ManagePositionContent,
} from './components/ManagePositionContent';

import type { IHeaderRightViewProps } from './components/HeaderRight';
import type { IWithdrawSuccessInfo } from './components/WithdrawSection';
import type { IEarnDepositDoneInfo } from '../../../Earn/pages/EarnRouter/EarnDepositDone';
import type { IEarnOutcome } from '../../components/UniversalStake/EarnFormSummary';

type ISelectedProtocol = {
  networkId: string;
  provider: string;
  vault?: string;
};

// Every deposit here can be paid with another token the wallet holds
const PAY_WITH: IManagePositionPayWith = {};
// Once a deposit is out the form fades this long, then the done view
const FORM_OUT_MS = 150;

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
  const fitModalRef = useFitModalHeight();
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
    | {
        offerKey?: string;
        amount?: string;
        offerOnly?: boolean;
        tokenImageUri?: string;
      }
    | undefined
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
  // A transaction that went out: the form (its footer and the header's
  // History with it) fades, then the done view takes its place
  const reduceMotion = useReducedMotion();
  const [isFormLeaving, setIsFormLeaving] = useState(false);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(doneTimerRef.current), []);
  const leaveFormThen = useCallback(
    (showDone: () => void) => {
      if (reduceMotion) {
        showDone();
        return;
      }
      setIsFormLeaving(true);
      clearTimeout(doneTimerRef.current);
      doneTimerRef.current = setTimeout(() => {
        showDone();
        setIsFormLeaving(false);
      }, FORM_OUT_MS);
    },
    [reduceMotion],
  );
  const handleWithdrawn = useCallback(
    (info: { amount: string; tokenImageUri?: string }) => {
      if (!better || !new BigNumber(info.amount).gt(0)) {
        navigation.popStack();
        return;
      }
      leaveFormThen(() =>
        setWithdrawn({ ...info, offer: better, fromOffer: from }),
      );
    },
    [better, from, leaveFormThen, navigation],
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

  // A deposit that went out: what went where shows in the form's place
  // until Done or My portfolio closes the modal
  const [depositDone, setDepositDone] = useState<IEarnDepositDoneInfo>();
  const showDepositDone = useCallback(
    (info: IEarnDepositDoneInfo) => leaveFormThen(() => setDepositDone(info)),
    [leaveFormThen],
  );
  const handleOffersDeposited = useCallback(
    (_amount: string, info: IEarnDepositDoneInfo) => showDepositDone(info),
    [showDepositDone],
  );
  // The figure the form showed for the amount, read as the deposit lands
  const sideOutcomeCarry = useMemo<{ current?: IEarnOutcome }>(() => ({}), []);
  // A box with no amount left (emptied, also by a pick in Pay with, or "0."
  // after a Backspace) has no figures to carry to the next form, as in the
  // deposit modal
  const handleSideAmountChange = useCallback(
    (value: string) => {
      if (!new BigNumber(value).gt(0)) {
        sideOutcomeCarry.current = undefined;
      }
    },
    [sideOutcomeCarry],
  );
  const handleSideDeposited = useCallback(
    (amount?: string, info?: IWithdrawSuccessInfo) => {
      if (!amount) {
        navigation.popStack();
        return;
      }
      showDepositDone({
        amount,
        symbol: info?.symbol || symbol,
        target: positionOffer
          ? getOfferTarget(positionOffer)
          : getEarnProviderDisplayName(selectedProtocol.provider),
        outcome: sideOutcomeCarry.current,
      });
    },
    [
      navigation,
      positionOffer,
      selectedProtocol.provider,
      showDepositDone,
      sideOutcomeCarry,
      symbol,
    ],
  );
  // The positions page, the way the details page's Positions link opens it:
  // the deposit is among them there
  const handleDonePortfolio = useCallback(() => {
    navigation.popStack();
    if (platformEnv.isNative) {
      EarnNavigation.pushToEarnPositions(navigation);
      return;
    }
    void EarnNavigation.popToEarnHome(navigation, { tab: 'portfolio' });
  }, [navigation]);

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
  if (depositDone) {
    body = (
      <EarnDepositDone
        info={depositDone}
        onPortfolio={handleDonePortfolio}
        onDone={() => navigation.popStack()}
      />
    );
  } else if (offersEntry) {
    body = (
      <EarnOffersDeposit
        symbol={symbol}
        networkId={selectedProtocol.networkId}
        logoURI={offersEntry.tokenImageUri ?? tokenImageUri}
        offerKey={offersEntry.offerKey}
        offerOnly={offersEntry.offerOnly}
        amount={offersEntry.amount}
        onHeaderRightChange={setHeaderControls}
        onDeposited={handleOffersDeposited}
      />
    );
  } else if (withdrawn) {
    body = (
      <EarnWithdrawDone
        symbol={symbol}
        amount={withdrawn.amount}
        offer={withdrawn.offer}
        fromOffer={withdrawn.fromOffer}
        networkId={selectedProtocol.networkId}
        logoURI={withdrawn.tokenImageUri ?? tokenImageUri}
        networkLogoURI={network?.logoURI}
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
      <EarnOutcomeCarryContext.Provider value={sideOutcomeCarry}>
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
          onDeposited={side === 'deposit' ? handleSideDeposited : undefined}
          onAmountChange={handleSideAmountChange}
          onHeaderRightChange={setHeaderControls}
          offerSwitch={positionRow}
        />
      </EarnOutcomeCarryContext.Provider>
    );
  }

  return (
    // The form's footer is drawn by the page, outside the body below: it
    // reads this to fade with the form
    <EarnFormLeavingContext.Provider value={isFormLeaving}>
      <Page
        scrollEnabled
        scrollProps={{ keyboardShouldPersistTaps: 'handled' }}
      >
        <Page.Header
          title={symbol}
          headerRight={
            headerControls
              ? () => (
                  <YStack
                    opacity={isFormLeaving ? 0 : 1}
                    transition="quick"
                    animateOnly={ANIMATE_ONLY_OPACITY}
                  >
                    <HeaderRightView {...headerControls} />
                  </YStack>
                )
              : undefined
          }
        />
        <Page.Body>
          {/* What the modal fits its height to, up to its usual size */}
          <YStack
            ref={fitModalRef}
            opacity={isFormLeaving ? 0 : 1}
            transition="quick"
            animateOnly={ANIMATE_ONLY_OPACITY}
          >
            {body}
          </YStack>
        </Page.Body>
      </Page>
    </EarnFormLeavingContext.Provider>
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
