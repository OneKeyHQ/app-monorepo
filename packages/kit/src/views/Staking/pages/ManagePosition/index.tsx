import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import { Page, YStack, useMedia } from '@onekeyhq/components';
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EModalStakingRoutes,
  type ETabEarnRoutes,
  type IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { type ISupportedSymbol } from '@onekeyhq/shared/types/earn';
import type { IEarnAssetPick } from '@onekeyhq/shared/types/earn/earnAssetSelect';
import { getEarnProviderDisplayName } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { EarnProviderMirror } from '../../../Earn/EarnProviderMirror';
import { EarnNavigation } from '../../../Earn/earnUtils';
import { leaveEarnWindowFor } from '../../../Earn/earnWindowReturn';
import { EarnAssetPickTrigger } from '../../../Earn/pages/EarnAssetSelect/EarnAssetPickTrigger';
import { isNetworkInPick } from '../../../Earn/pages/EarnAssetSelect/earnAssetSelect.utils';
import { EarnDepositDone } from '../../../Earn/pages/EarnRouter/EarnDepositDone';
import {
  EarnOfferSwitcher,
  EarnOffersDeposit,
} from '../../../Earn/pages/EarnRouter/EarnOffersDeposit';
import {
  EARN_ROUTER_MODAL_HEIGHT,
  findOffer,
  pickBetterOffer,
} from '../../../Earn/pages/EarnRouter/earnRouter.utils';
import {
  getOfferTarget,
  useEarnRouterOffers,
} from '../../../Earn/pages/EarnRouter/EarnRouterOffer';
import { EarnWithdrawDone } from '../../../Earn/pages/EarnRouter/EarnWithdrawDone';
import {
  getOfferNetworkId,
  useEarnNetworkAssets,
} from '../../../Earn/pages/EarnRouter/useEarnNetworkAssets';
import { EarnFormLeavingContext } from '../../components/EarnFooterFade';
import { EarnOutcomeCarryContext } from '../../components/UniversalStake/EarnFormSummary';
import {
  easeModalHeightChanges,
  useFitModalHeight,
} from '../../hooks/useFitModalHeight';

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
// Growing into the full router, the columns fade in this long after the
// window starts taking its size (the navigator's 250 ms), as it lands
const ROUTER_GROW_MS = 200;

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
  // The full Earn router keeps the routers' fixed size, what it holds
  // scrolling inside; otherwise the modal is as tall as its form
  const isFullRouter = Boolean(route.params.earnOffers?.wide);
  const fitModalRef = useFitModalHeight(
    !isFullRouter,
    undefined,
    isFullRouter ? EARN_ROUTER_MODAL_HEIGHT : undefined,
  );
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
  const intl = useIntl();
  // Opened for the token's offers on a network (a home row), or switched to
  // them by a withdrawal's better rate
  const [offersEntry, setOffersEntry] = useState<
    | {
        offerKey?: string;
        amount?: string;
        offerOnly?: boolean;
        wide?: boolean;
        tokenImageUri?: string;
        payKey?: string;
      }
    | undefined
  >(route.params.earnOffers);
  // The router: the title picks what to earn on, a token or a kind of token
  // compared across its tokens on this network. A details page's own
  // deposit (that offer alone) keeps its token
  const isRouter = Boolean(offersEntry && !offersEntry.offerOnly);
  const routeAssetClass = route.params.earnOffers?.assetClass;
  // On every network where the entry asks for it (a home row, by token since
  // 11-05), else on the route's network
  const [assetPick, setAssetPick] = useState<IEarnAssetPick>(() => {
    const pickNetworkId = route.params.earnOffers?.allNetworks
      ? undefined
      : route.params.networkId;
    return routeAssetClass
      ? { kind: 'class', assetClass: routeAssetClass, networkId: pickNetworkId }
      : { kind: 'token', symbol, networkId: pickNetworkId };
  });
  const handleAssetPick = useCallback((pick: IEarnAssetPick) => {
    // The form under the title is built again around the new offers
    easeModalHeightChanges();
    setAssetPick(pick);
  }, []);
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
  // What Earn pays on, token by token on every network: the title's
  // selector lists it, and the offers come from it
  const networkAssets = useEarnNetworkAssets({ enabled: isRouter });
  const pickNetwork = assetPick.networkId
    ? networkAssets.networkById.get(assetPick.networkId)
    : undefined;
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
  // One offer's window growing into the full router: the form fades, the
  // window takes the router's size (the navigator eases its width, the
  // height eases as fitting stops) and the columns fade in as it lands
  const growIntoRouter = useCallback(
    (grow: () => void) => {
      if (reduceMotion) {
        grow();
        return;
      }
      setIsFormLeaving(true);
      clearTimeout(doneTimerRef.current);
      doneTimerRef.current = setTimeout(() => {
        grow();
        doneTimerRef.current = setTimeout(
          () => setIsFormLeaving(false),
          ROUTER_GROW_MS,
        );
      }, FORM_OUT_MS);
    },
    [reduceMotion],
  );
  // A kind of token, or a token's several offers, are the full router's:
  // one offer's window grows into it, and the full router stays as it is
  const { gtLg: isWideScreen } = useMedia();
  const handlePickAsset = useCallback(
    (pick: IEarnAssetPick) => {
      const earnOffers = route.params.earnOffers;
      const listsOffers =
        pick.kind === 'class' ||
        (
          networkAssets.offersBySymbol.get(pick.symbol.toLowerCase()) ?? []
        ).filter((offer) => isNetworkInPick(pick, getOfferNetworkId(offer)))
          .length > 1;
      if (earnOffers?.wide || !listsOffers) {
        handleAssetPick(pick);
        return;
      }
      growIntoRouter(() => {
        handleAssetPick(pick);
        navigation.setParams({ earnOffers: { ...earnOffers, wide: true } });
      });
    },
    [
      growIntoRouter,
      handleAssetPick,
      navigation,
      networkAssets.offersBySymbol,
      route.params.earnOffers,
    ],
  );
  // Where the window can't hold the offers beside the form, the full router
  // keeps the usual width, its offers under the form
  const isColumns = isFullRouter && isWideScreen;
  useEffect(() => {
    const earnOffers = route.params.earnOffers;
    if (earnOffers?.wide && Boolean(earnOffers.narrow) === isWideScreen) {
      navigation.setParams({
        earnOffers: { ...earnOffers, narrow: !isWideScreen },
      });
    }
  }, [isWideScreen, navigation, route.params.earnOffers]);
  const handleOpenAssetSelect = useCallback(() => {
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.EarnRouterAssetSelect,
      params: {
        purpose: 'earn',
        // Named for what it picks, the token to deposit, as the Loans
        // window's pickers are ("Collateral", "Borrow"); Pay with's own is
        // "Pay with" (demo 10-29)
        title: intl.formatMessage({ id: ETranslations.earn_deposit }),
        tokens: networkAssets.tokens,
        networks: networkAssets.networks,
        selected: assetPick,
        onSelect: handlePickAsset,
      },
    });
  }, [
    assetPick,
    handlePickAsset,
    intl,
    navigation,
    networkAssets.networks,
    networkAssets.tokens,
  ]);
  // Details closes the window for an offer's page. Back from that page opens
  // it again as it was left: what the title picked, the offer, the amount
  // and Pay with's token (demo 10-30)
  const handleLeaveForDetails = useCallback(
    (
      page:
        | ETabEarnRoutes.EarnLendingDetails
        | ETabEarnRoutes.EarnProtocolDetails,
      left: {
        offerKey: string;
        networkId: string;
        amount?: string;
        payKey?: string;
      },
    ) => {
      const pickedSymbol =
        assetPick.kind === 'token' ? assetPick.symbol : undefined;
      const pickedLogo = pickedSymbol
        ? networkAssets.tokens.find(
            (token) =>
              token.symbol.toLowerCase() === pickedSymbol.toLowerCase(),
          )?.logoURI
        : undefined;
      leaveEarnWindowFor(page, {
        screen: EModalStakingRoutes.ManagePosition,
        params: {
          // The offer's network; the pick's networks come back with it
          networkId: left.networkId,
          symbol: pickedSymbol ?? symbol,
          provider: '',
          tab: 'deposit',
          tokenImageUri:
            pickedLogo || offersEntry?.tokenImageUri || tokenImageUri,
          earnOffers: {
            ...route.params.earnOffers,
            offerKey: left.offerKey,
            amount: left.amount,
            payKey: left.payKey,
            assetClass:
              assetPick.kind === 'class' ? assetPick.assetClass : undefined,
            allNetworks: !assetPick.networkId,
          },
        },
      });
    },
    [
      assetPick,
      networkAssets.tokens,
      offersEntry?.tokenImageUri,
      route.params.earnOffers,
      symbol,
      tokenImageUri,
    ],
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
      leaveFormThen(() =>
        setWithdrawn({ ...info, offer: better, fromOffer: from }),
      );
    },
    [better, from, leaveFormThen, navigation],
  );
  // The better rate opens here, in this modal, with what was withdrawn: the
  // token has two offers here at least, so the window grows into the full
  // router, that offer picked
  const handleDepositBetter = useCallback(() => {
    if (!withdrawn) {
      return;
    }
    const earnOffers = route.params.earnOffers;
    growIntoRouter(() => {
      setOffersEntry({
        offerKey: withdrawn.offer.key,
        amount: withdrawn.amount,
        tokenImageUri: withdrawn.tokenImageUri,
      });
      setWithdrawn(undefined);
      navigation.setParams({ earnOffers: { ...earnOffers, wide: true } });
    });
  }, [growIntoRouter, navigation, route.params.earnOffers, withdrawn]);

  // A deposit that went out: what went where shows in the form's place
  // until Done or My portfolio closes the modal
  const [depositDone, setDepositDone] = useState<IEarnDepositDoneInfo>();
  // A modal opened wide for the offers beside the form goes back to the usual
  // width with its done view, which is one centered column
  const routeEarnOffers = route.params.earnOffers;
  const showDepositDone = useCallback(
    (info: IEarnDepositDoneInfo) =>
      leaveFormThen(() => {
        setDepositDone(info);
        if (routeEarnOffers?.wide) {
          navigation.setParams({
            earnOffers: { ...routeEarnOffers, wide: false },
          });
        }
      }),
    [leaveFormThen, navigation, routeEarnOffers],
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
        routesBeside={isFullRouter}
        amount={offersEntry.amount}
        startPayKey={offersEntry.payKey}
        onLeaveForDetails={isRouter ? handleLeaveForDetails : undefined}
        onHeaderRightChange={setHeaderControls}
        onDeposited={handleOffersDeposited}
        assetPick={isRouter ? assetPick : undefined}
        networkAssets={isRouter ? networkAssets : undefined}
        onAssetPickChange={isRouter ? handlePickAsset : undefined}
        pickPill={
          isRouter ? (
            <EarnAssetPickTrigger
              variant="pill"
              pick={assetPick}
              tokens={networkAssets.tokens}
              networks={networkAssets.networks}
              purpose="earn"
              fallbackLogoURI={offersEntry.tokenImageUri ?? tokenImageUri}
              // The pick's network before the list names it; the pill
              // says "on All networks" itself when the pick has none
              networkLogoURI={pickNetwork?.logoURI}
              networkName={pickNetwork?.name}
              onPress={handleOpenAssetSelect}
            />
          ) : undefined
        }
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

  // The router is Earn's window, its pick heading the form; the done view
  // names what went in
  let title: string = symbol;
  if (depositDone) {
    title = depositDone.symbol;
  } else if (isRouter && !withdrawn) {
    title = intl.formatMessage({ id: ETranslations.earn_title });
  }

  return (
    // The form's footer is drawn by the page, outside the body below: it
    // reads this to fade with the form
    <EarnFormLeavingContext.Provider value={isFormLeaving}>
      {/* Beside the form, each column scrolls by itself and nothing else
          does */}
      <Page
        scrollEnabled={!isColumns}
        scrollProps={{ keyboardShouldPersistTaps: 'handled' }}
      >
        <Page.Header
          title={title}
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
          {/* What the modal fits its height to, up to its usual size; the
              full router's columns fill its fixed one */}
          <YStack
            ref={fitModalRef}
            flex={isColumns ? 1 : undefined}
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
