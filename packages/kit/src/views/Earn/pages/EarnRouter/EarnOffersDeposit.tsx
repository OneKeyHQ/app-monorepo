import type { ReactNode, RefObject } from 'react';
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import type { IElement } from '@onekeyhq/components';
import {
  Accordion,
  Icon,
  ScrollView,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useEarnPortfolioInvestmentsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/earn';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabEarnRoutes } from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';

import { EarnFormActionPlacementContext } from '../../../Staking/components/EarnFormFooter';
import { ProtocolSwitchRow } from '../../../Staking/components/UniversalStake';
import {
  EarnFormSwitchingContext,
  EarnOutcomeCarryContext,
} from '../../../Staking/components/UniversalStake/EarnFormSummary';
import { useEarnAccount } from '../../../Staking/hooks/useEarnAccount';
import { easeModalHeightChanges } from '../../../Staking/hooks/useFitModalHeight';
import {
  ManagePositionContent,
  ManageSectionShell,
} from '../../../Staking/pages/ManagePosition/components/ManagePositionContent';
import { EManagePositionType } from '../../../Staking/pages/ManagePosition/hooks/useManagePage';
import {
  findPositionDeposit,
  sumPortfolioDeposits,
} from '../../components/desktopHome/earnDesktopHome.utils';
import { EARN_DESKTOP_DEMO_COPY } from '../../components/desktopHome/earnDesktopHomeCopy';
import { buildKeyboardPressProps } from '../../components/desktopHome/earnDesktopPressable';
import { EarnNavigation } from '../../earnUtils';
import { useEarnAccountKey } from '../../hooks/useEarnAccountKey';
import {
  LIST_PICK_APPLY_MS,
  getListHeightTransition,
  getListRowMotion,
} from '../../utils/earnListMotion';
import { getEarnAssetClassLabel } from '../EarnAssetSelect/earnAssetClassLabel';
import { EarnAssetLogos } from '../EarnAssetSelect/EarnAssetLogos';
import { scopeAssetSelectTokens } from '../EarnAssetSelect/earnAssetSelect.utils';

import { EarnOfferFacts } from './EarnOfferFacts';
import {
  EARN_OFFER_OPTION_HEIGHT,
  EarnOfferOptionCard,
} from './EarnOfferOptionCard';
import {
  BETTER_RATE_MIN_GAIN,
  EARN_OFFER_ROUTES_COLUMN_WIDTH,
} from './earnRouter.utils';
import {
  buildOfferRowProps,
  getOfferSymbol,
  getOfferTarget,
  useEarnRouterOffers,
} from './EarnRouterOffer';
import { getOfferNetwork, getOfferNetworkId } from './useEarnNetworkAssets';
import { useEscapeFoldsList } from './useEscapeFoldsList';
import { warmFormData } from './useWarmOffersDeposit';

import type { IEarnDepositDoneInfo } from './EarnDepositDone';
import type { IEarnNetworkAssets } from './useEarnNetworkAssets';
import type { IEarnOutcome } from '../../../Staking/components/UniversalStake/EarnFormSummary';
import type { IHeaderRightViewProps } from '../../../Staking/pages/ManagePosition/components/HeaderRight';
import type {
  IManagePositionFooterAction,
  IManagePositionPayWith,
} from '../../../Staking/pages/ManagePosition/components/ManagePositionContent';
import type { IWithdrawSuccessInfo } from '../../../Staking/pages/ManagePosition/components/WithdrawSection';
import type { IEarnDesktopHoldOffer } from '../../components/desktopHome/earnDesktopHome.utils';
import type {
  IEarnAssetClass,
  IEarnAssetPick,
  IEarnAssetSelectToken,
} from '../EarnAssetSelect/earnAssetSelect.utils';

// An offer under the switcher's row when the list is open: the same row,
// its rate lined up with the one above, so a pick moves up into its place
// as it is
function OfferSwitcherItem({
  offer,
  index,
  networkLogoURI,
  onSelect,
  focusRef,
}: {
  offer: IEarnDesktopHoldOffer;
  // Its place in the list: each row comes in a moment after the one above
  index: number;
  networkLogoURI?: string;
  onSelect: (offer: IEarnDesktopHoldOffer) => void;
  // Set for the first row when the list opens from the keyboard
  focusRef?: RefObject<boolean>;
}) {
  const intl = useIntl();
  const reduceMotion = useReducedMotion();
  const handlePress = useCallback(() => onSelect(offer), [offer, onSelect]);
  const rowRef = useRef<IElement>(null);
  useEffect(() => {
    if (focusRef?.current) {
      focusRef.current = false;
      rowRef.current?.focus();
    }
  }, [focusRef]);
  return (
    <YStack {...getListRowMotion(index, reduceMotion)}>
      <ProtocolSwitchRow
        ref={rowRef}
        testID={`earn-offer-${offer.key}`}
        {...buildOfferRowProps(offer, { intl })}
        networkLogoURI={networkLogoURI}
        isSwitchEnabled
        showChevron={false}
        chevronSpace
        onPress={handlePress}
        keyboardProps={buildKeyboardPressProps(handlePress)}
      />
    </YStack>
  );
}

const OFFER_LIST_VALUE = 'offers';
const OFFER_LIST_HIDDEN_STYLE = { opacity: 0 } as const;

// The deposit modal's protocol switcher, for the token's offers on one
// network: lending markets and Fixed Income among them. Its row unfolds the
// other offers under itself, in the same panel, and they fold back once one
// is picked. With one offer it is the row alone, naming the protocol a
// position's modal is for
export function EarnOfferSwitcher({
  offers,
  selected,
  networkLogoURI,
  isOpen = false,
  listedWithout,
  shownRowKeyRef,
  onOpenChange,
  onSelect,
}: {
  offers: IEarnDesktopHoldOffer[];
  selected: IEarnDesktopHoldOffer;
  networkLogoURI?: string;
  // Held by the modal: a pick can swap the form this sits in, and the list
  // folds after that, from where it was
  isOpen?: boolean;
  // The offer the row showed as the list opened, left out of it until it
  // folds, so the rows under the pointer stay put
  listedWithout?: string;
  // The offer the row showed last, kept by the modal while the form around
  // the row is built again (a switch to another protocol's form): only a
  // pick fades into the row, never the same row drawn again
  shownRowKeyRef?: { current?: string };
  onOpenChange?: (isOpen: boolean) => void;
  onSelect?: (offer: IEarnDesktopHoldOffer) => void;
}) {
  const intl = useIntl();
  const focusFirstRef = useRef(false);
  // Decided as the row for an offer appears and kept while it shows that
  // offer: the row would be drawn again as a new view if it gained an
  // enterStyle later
  const rowFadeRef = useRef<{ key: string; fadesIn: boolean } | undefined>(
    undefined,
  );
  if (rowFadeRef.current?.key !== selected.key) {
    rowFadeRef.current = {
      key: selected.key,
      fadesIn:
        !shownRowKeyRef ||
        (shownRowKeyRef.current !== undefined &&
          shownRowKeyRef.current !== selected.key),
    };
  }
  const { fadesIn } = rowFadeRef.current;
  useEffect(() => {
    if (shownRowKeyRef) {
      shownRowKeyRef.current = selected.key;
    }
  }, [selected.key, shownRowKeyRef]);
  const rowRef = useRef<IElement>(null);
  const reduceMotion = useReducedMotion();
  const canSwitch = offers.length > 1 && Boolean(onSelect);
  const handleToggle = useCallback(
    () => onOpenChange?.(!isOpen),
    [isOpen, onOpenChange],
  );
  const handleKeyboardToggle = useCallback(() => {
    focusFirstRef.current = !isOpen;
    onOpenChange?.(!isOpen);
  }, [isOpen, onOpenChange]);
  const handlePick = useCallback(
    (offer: IEarnDesktopHoldOffer) => onSelect?.(offer),
    [onSelect],
  );
  // Escape folds an open list back to its row, and the focus goes to the row
  // when it was on the row or in the list
  const switcherRef = useRef<IElement>(null);
  const handleEscape = useCallback(
    (wasFocusInList: boolean) => {
      onOpenChange?.(false);
      if (wasFocusInList) {
        rowRef.current?.focus();
      }
    },
    [onOpenChange],
  );
  useEscapeFoldsList(isOpen, handleEscape, switcherRef);
  const row = (
    <ProtocolSwitchRow
      ref={rowRef}
      testID="earn-offer-switch"
      {...buildOfferRowProps(selected, { intl })}
      networkLogoURI={networkLogoURI}
      isSwitchEnabled={canSwitch}
      showChevron={canSwitch}
      isExpanded={canSwitch ? isOpen : undefined}
      onPress={handleToggle}
      keyboardProps={buildKeyboardPressProps(
        canSwitch ? handleKeyboardToggle : undefined,
      )}
    />
  );
  if (!canSwitch) {
    return row;
  }
  const hiddenKey = listedWithout ?? selected.key;
  const listed = offers.filter((offer) => offer.key !== hiddenKey);
  return (
    <YStack
      bg="$bgSubdued"
      borderRadius="$3"
      borderCurve="continuous"
      ref={switcherRef}
    >
      <Accordion
        type="single"
        collapsible
        value={isOpen ? OFFER_LIST_VALUE : ''}
        onValueChange={(value: string) =>
          onOpenChange?.(value === OFFER_LIST_VALUE)
        }
      >
        <Accordion.Item value={OFFER_LIST_VALUE}>
          {/* A pick fades into the row as the list folds under it */}
          <YStack
            key={selected.key}
            transition="quick"
            animateOnly={ANIMATE_ONLY_OPACITY}
            enterStyle={fadesIn ? OFFER_LIST_HIDDEN_STYLE : undefined}
          >
            {row}
          </YStack>
          <Accordion.HeightAnimator
            transition={getListHeightTransition(isOpen, reduceMotion)}
          >
            {/* The rows come in themselves; the list fades out as it folds */}
            <Accordion.Content
              unstyled
              transition="quick"
              animateOnly={ANIMATE_ONLY_OPACITY}
              exitStyle={OFFER_LIST_HIDDEN_STYLE}
            >
              {listed.map((offer, index) => (
                <OfferSwitcherItem
                  key={offer.key}
                  offer={offer}
                  index={index}
                  networkLogoURI={networkLogoURI}
                  onSelect={handlePick}
                  focusRef={index === 0 ? focusFirstRef : undefined}
                />
              ))}
            </Accordion.Content>
          </Accordion.HeightAnimator>
        </Accordion.Item>
      </Accordion>
    </YStack>
  );
}

// Every offer for the token on this network, each a card in view, as the
// Swap page lists its routes: a press picks it at once, and the form takes
// it with what was typed. The pointer over a card reads its form ahead
function EarnOfferRoutes({
  offers,
  selectedKey,
  networkLogoURI,
  tokenOf,
  payRouteOf,
  showsNetwork = false,
  footer,
  renderFacts,
  onSelect,
  onHoverIn,
}: {
  offers: IEarnDesktopHoldOffer[];
  selectedKey?: string;
  // The network's logo where an offer carries none of its own
  networkLogoURI?: string;
  // The offers span networks (All Networks): each card names its own
  showsNetwork?: boolean;
  // A card's facts, which show while it is the one picked
  renderFacts?: (
    offer: IEarnDesktopHoldOffer,
    isSelected: boolean,
  ) => ReactNode;
  // Comparing a kind of token: each card's token
  tokenOf?: (
    offer: IEarnDesktopHoldOffer,
  ) => { symbol: string; logoURI?: string } | undefined;
  // What comes before a card's deposit: a swap or a bridge from Pay with
  payRouteOf?: (offer: IEarnDesktopHoldOffer) => 'swap' | 'bridge' | undefined;
  // Under the cards: the token's whole kind, where it pays more
  footer?: ReactNode;
  onSelect: (offer: IEarnDesktopHoldOffer) => void;
  onHoverIn: (offer: IEarnDesktopHoldOffer) => void;
}) {
  const intl = useIntl();
  return (
    <YStack gap="$2">
      <YStack
        testID="earn-offer-routes"
        role="radiogroup"
        aria-label={intl.formatMessage({ id: ETranslations.global_protocol })}
        gap="$2"
      >
        {offers.map((offer) => (
          <EarnOfferOptionCard
            key={offer.key}
            testID={`earn-offer-${offer.key}`}
            offer={offer}
            networkLogoURI={getOfferNetwork(offer).logoURI || networkLogoURI}
            networkName={showsNetwork ? getOfferNetwork(offer).name : undefined}
            token={tokenOf?.(offer)}
            payRoute={payRouteOf?.(offer)}
            isSelected={offer.key === selectedKey}
            facts={renderFacts?.(offer, offer.key === selectedKey)}
            onSelect={onSelect}
            onHoverIn={onHoverIn}
          />
        ))}
      </YStack>
      {footer}
    </YStack>
  );
}

// Under one token's cards: its whole kind on this network, where another
// token of it pays more. A press compares them all, the card picked stays
function EarnClassHint({
  label,
  logos,
  rate,
  onPress,
}: {
  label: string;
  logos: string[];
  rate: number;
  onPress: () => void;
}) {
  return (
    <XStack
      testID="earn-offer-class-hint"
      role="button"
      group
      ai="center"
      gap="$3"
      px="$4"
      py="$3"
      borderRadius="$3"
      borderCurve="continuous"
      borderWidth={1}
      borderColor="$borderSubdued"
      borderStyle="dashed"
      userSelect="none"
      cursor="pointer"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={onPress}
      {...buildKeyboardPressProps(onPress, 2)}
    >
      <EarnAssetLogos logos={logos} size="xs" />
      <SizableText size="$bodyMd" color="$textSubdued" flex={1} minWidth={0}>
        {EARN_DESKTOP_DEMO_COPY.earnClassHint(label)}
      </SizableText>
      <SizableText size="$bodyMdMedium" color="$textSuccess" flexShrink={0}>
        {`${rate.toFixed(2)}%`}
      </SizableText>
      <Icon
        name="ChevronRightSmallOutline"
        size="$5"
        color="$iconSubdued"
        flexShrink={0}
      />
    </XStack>
  );
}

// Beside the form the offers' column stands in for the switcher: the slot
// stays set, so the form keeps the deposit modal's ways (the amount carried
// across a switch, the balance kept), and draws nothing
const ROUTES_BESIDE_SLOT = <Fragment />;

// The form a protocol fills, as ManagePositionContent picks it. A switch
// within one form keeps it, typed amount and all: it shows the last
// protocol's figures, its button waiting, until the new ones arrive. A
// protocol that fills another form starts it over with what was typed
function getOfferFormKind(offer: IEarnDesktopHoldOffer, symbol: string) {
  if (offer.kind === 'lending') {
    return 'normal';
  }
  if (earnUtils.isPendleProvider({ providerName: offer.item.provider.name })) {
    return 'pendle';
  }
  const normalizedSymbol = symbol.toLowerCase();
  if (normalizedSymbol === 'usde' || normalizedSymbol === 'ada') {
    return normalizedSymbol;
  }
  return 'normal';
}

type IOfferFormParams = {
  networkId: string;
  symbol: string;
  provider: string;
  vault?: string;
  type?: EManagePositionType;
  marketAddress?: string;
  reserveAddress?: string;
  accountId: string;
  indexedAccountId?: string;
  fallbackTokenImageUri?: string;
};

// The params the form for an offer reads its data with: the same for the
// form and for reading it ahead
function useOfferFormParams({
  networkId,
  symbol,
  logoURI,
  logoOf,
}: {
  networkId: string;
  symbol: string;
  logoURI?: string;
  // Comparing a kind of token, each offer's token has its own logo
  logoOf?: (symbol: string) => string | undefined;
}) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { selectedAccount } = useSelectedAccount({ num: 0 });
  const indexedAccountId =
    selectedAccount.indexedAccountId || activeAccount.indexedAccount?.id;
  const { earnAccount } = useEarnAccount({
    networkId,
    accountId: activeAccount.account?.id,
    indexedAccountId,
  });
  return useCallback(
    (offer: IEarnDesktopHoldOffer): IOfferFormParams => {
      const offerSymbol = getOfferSymbol(offer, symbol);
      const offerLogo = logoOf?.(offerSymbol) ?? logoURI;
      // Each offer on its own network: across networks they differ
      const offerNetworkId = getOfferNetworkId(offer) || networkId;
      if (offer.kind === 'lending') {
        const { offer: lending } = offer;
        return {
          networkId: offerNetworkId,
          symbol: lending.symbol,
          provider: lending.market.provider,
          type: EManagePositionType.Supply,
          marketAddress: lending.market.marketAddress,
          reserveAddress: lending.reserveAddress,
          // Lending supply goes through the market's own account on this
          // network, as the Borrow pages pass it
          accountId:
            earnAccount?.account?.id || activeAccount.account?.id || '',
          indexedAccountId:
            earnAccount?.account?.indexedAccountId ?? indexedAccountId,
          fallbackTokenImageUri: offerLogo ?? lending.logoURI,
        };
      }
      const providerName = offer.item.provider.name;
      return {
        networkId: offerNetworkId,
        symbol: offerSymbol,
        provider: providerName,
        vault: earnUtils.shouldSendEarnProtocolVault({ providerName })
          ? offer.item.provider.vault
          : undefined,
        // Cross-network, the form takes the external wallet's account only
        accountId: selectedAccount.othersWalletAccountId || '',
        indexedAccountId,
        fallbackTokenImageUri: offerLogo,
      };
    },
    [
      activeAccount.account?.id,
      earnAccount?.account?.id,
      earnAccount?.account?.indexedAccountId,
      indexedAccountId,
      logoOf,
      logoURI,
      networkId,
      selectedAccount.othersWalletAccountId,
      symbol,
    ],
  );
}

// Reads an offer's form ahead, so it opens complete: the better rate a
// withdrawal's done view offers, before its Deposit is pressed
export function useWarmOfferForm(args: {
  networkId: string;
  symbol: string;
  logoURI?: string;
}) {
  const buildParams = useOfferFormParams(args);
  return useCallback(
    (offer: IEarnDesktopHoldOffer) => warmFormData(buildParams(offer)),
    [buildParams],
  );
}

// The deposit side of the manage form for the chosen offer, with Pay with
function OfferDepositForm({
  offer,
  symbol,
  networkId,
  logoURI,
  initialAmount,
  payWith,
  offerSwitch,
  onAmountChange,
  onHeaderRightChange,
  onDeposited,
  footerActionOverride,
  logoOf,
}: {
  offer: IEarnDesktopHoldOffer;
  symbol: string;
  networkId: string;
  logoURI?: string;
  logoOf?: (symbol: string) => string | undefined;
  initialAmount?: string;
  payWith: IManagePositionPayWith;
  offerSwitch: ReactNode;
  onAmountChange: (amount: string) => void;
  onHeaderRightChange?: (view: IHeaderRightViewProps | null) => void;
  onDeposited?: (amount?: string, info?: IWithdrawSuccessInfo) => void;
  footerActionOverride?: IManagePositionFooterAction;
}) {
  const buildParams = useOfferFormParams({
    networkId,
    symbol,
    logoURI,
    logoOf,
  });
  const params = useMemo(() => buildParams(offer), [buildParams, offer]);

  return (
    <ManagePositionContent
      depositOnly
      isInModalContext
      {...params}
      initialAmount={initialAmount}
      providerDisplayName={
        offer.kind === 'lending' ? offer.offer.marketLabel : undefined
      }
      providerLogoUri={
        offer.kind === 'lending' ? offer.offer.market.logoURI : undefined
      }
      payWith={payWith}
      offerSwitch={offerSwitch}
      onAmountChange={onAmountChange}
      onHeaderRightChange={onHeaderRightChange}
      onDeposited={onDeposited}
      footerActionOverride={footerActionOverride}
    />
  );
}

/**
 * The deposit modal opened for a token on one network (a row of Earns on
 * your holding, or a better rate after a withdrawal): every offer for it
 * there in the protocol switcher, the best rate first unless one is asked
 * for. Switching offers keeps the amount and the Pay with token
 */
// The kind's token the wallet holds the most of here, by value
function largestHeldSymbol(
  tokens: IEarnAssetSelectToken[] | undefined,
  assetClass: IEarnAssetClass,
) {
  return (tokens ?? [])
    .filter((token) => token.type === assetClass && token.fiatValue)
    .toSorted((a, b) => (b.fiatValue ?? 0) - (a.fiatValue ?? 0))[0]?.symbol;
}

export function EarnOffersDeposit({
  symbol,
  networkId,
  logoURI,
  offerKey,
  offerOnly,
  offersLayout = 'routes',
  routesBeside = false,
  amount,
  onHeaderRightChange,
  onDeposited,
  footerActionOverride,
  onAmountChange,
  onOfferChange,
  payWithPickerHeight,
  assetPick,
  networkAssets,
  onAssetPickChange,
  pickPill,
  startPayKey,
  onLeaveForDetails,
}: {
  symbol: string;
  networkId: string;
  logoURI?: string;
  offerKey?: string;
  // That offer alone, with none to switch to (a details page's own deposit)
  offerOnly?: boolean;
  // How the other offers show: every one as a card in view (under the amount
  // box, or beside the form in a wide modal), or folded under the chosen
  // one's row (the guide, which chose the vault a step before)
  offersLayout?: 'routes' | 'switcher';
  // The modal opened wide for the offers' column beside the form
  routesBeside?: boolean;
  // An amount of the token itself to start on (what a withdrawal took out)
  amount?: string;
  onHeaderRightChange?: (view: IHeaderRightViewProps | null) => void;
  // Once the deposit is out, in place of closing: what went in and where,
  // for the modal's done view (the guide shows its last step)
  onDeposited?: (amount: string, done: IEarnDepositDoneInfo) => void;
  footerActionOverride?: IManagePositionFooterAction;
  onAmountChange?: (amount: string) => void;
  // The offer the form is on, as it starts and after each switch
  onOfferChange?: (offerKey: string) => void;
  // Wide windows: Pay with's picker as tall as the modal the form is in,
  // where that one is taller than the picker (the desktop Earn guide)
  payWithPickerHeight?: number;
  // What the pick at the head of the form chose to earn on: a token, or a
  // kind of token compared across its tokens here. Unset, the symbol's
  // offers
  assetPick?: IEarnAssetPick;
  // What the network pays on, token by token: a kind's offers come from it
  networkAssets?: IEarnNetworkAssets;
  // The line under one token's offers that compares its whole kind
  onAssetPickChange?: (pick: IEarnAssetPick) => void;
  // The pick's control, at the head of the form
  pickPill?: ReactNode;
  // Pay with's token to start on (the window opened again as it was left)
  startPayKey?: string;
  // Details closes the window for an offer's page: what the window held, so
  // Back from that page can open it again
  onLeaveForDetails?: (
    page:
      | ETabEarnRoutes.EarnLendingDetails
      | ETabEarnRoutes.EarnProtocolDetails,
    left: {
      offerKey: string;
      // The offer's network, which the window opens on again
      networkId: string;
      amount?: string;
      payKey?: string;
    },
  ) => void;
}) {
  const intl = useIntl();
  const pickedClass: IEarnAssetClass | undefined =
    assetPick?.kind === 'class' ? assetPick.assetClass : undefined;
  const tokenSymbol = assetPick?.kind === 'token' ? assetPick.symbol : symbol;
  // The pick's network, or every network (11-05): the router lists each
  // network's offers for it, Pay with bridging where its token is elsewhere
  const scopeNetworkId = assetPick?.networkId;
  const isInScope = useCallback(
    (offer: IEarnDesktopHoldOffer) =>
      !scopeNetworkId || getOfferNetworkId(offer) === scopeNetworkId,
    [scopeNetworkId],
  );
  const { offers: tokenOffers, isLoaded: isTokenLoaded } = useEarnRouterOffers({
    symbol: tokenSymbol,
    networkId: scopeNetworkId ?? networkId,
    enabled: !pickedClass,
  });
  const assetTokens = networkAssets?.tokens;
  const offersBySymbol = networkAssets?.offersBySymbol;
  // Every network's figures, for logos and for where the wallet holds a
  // token (Pay with spans every network)
  const tokenBySymbol = useMemo(
    () =>
      new Map(
        (assetTokens ?? []).map((token) => [token.symbol.toLowerCase(), token]),
      ),
    [assetTokens],
  );
  // The pick's networks' figures, for its kinds and rates
  const scopedTokens = useMemo(
    () =>
      assetTokens ? scopeAssetSelectTokens(assetTokens, scopeNetworkId) : [],
    [assetTokens, scopeNetworkId],
  );
  const logoOf = useCallback(
    (offerSymbol: string) =>
      tokenBySymbol.get(offerSymbol.toLowerCase())?.logoURI || undefined,
    [tokenBySymbol],
  );
  // A kind's offers: every token of it here, the best rate first. Their keys
  // name the token, as two tokens can share a protocol without a vault
  const classOffers = useMemo(() => {
    if (!pickedClass || !offersBySymbol) {
      return [];
    }
    return scopedTokens
      .filter((token) => token.type === pickedClass)
      .flatMap((token) =>
        (offersBySymbol.get(token.symbol.toLowerCase()) ?? [])
          .filter(isInScope)
          .map((offer) => ({
            ...offer,
            key: `${token.symbol.toLowerCase()}|${offer.key}`,
          })),
      )
      .toSorted((a, b) => b.apr - a.apr);
  }, [isInScope, offersBySymbol, pickedClass, scopedTokens]);
  const routerTokenOffers = useMemo(
    () =>
      (offersBySymbol?.get(tokenSymbol.toLowerCase()) ?? []).filter(isInScope),
    [isInScope, offersBySymbol, tokenSymbol],
  );
  const [pickedKey, setPickedKey] = useState(offerKey);
  let allOffers = tokenOffers;
  let isLoaded = isTokenLoaded;
  if (pickedClass) {
    allOffers = classOffers;
    isLoaded = Boolean(networkAssets?.isLoaded);
  } else if (networkAssets?.isLoaded) {
    allOffers = routerTokenOffers;
    isLoaded = true;
  } else if (networkAssets) {
    // Until every network's offers are in: the token's on the window's own
    // network, where the offer asked for is (the home row's best), so the
    // form opens on it at once and stays on it
    isLoaded =
      isTokenLoaded &&
      Boolean(pickedKey) &&
      tokenOffers.some((offer) => offer.key === pickedKey);
  }
  const offers = useMemo(
    () =>
      offerOnly && offerKey
        ? allOffers.filter((offer) => offer.key === offerKey)
        : allOffers,
    [allOffers, offerKey, offerOnly],
  );
  const { result: network } = usePromiseResult(
    () => backgroundApiProxy.serviceNetwork.getNetworkSafe({ networkId }),
    [networkId],
  );

  // Sent with an amount of the token itself, Pay with starts on that token
  // even before the withdrawal lands in the wallet
  const [payKey, setPayKey] = useState<string | undefined>(startPayKey);
  // The token the form pays with and its network, for the cards a swap or a
  // bridge comes before
  const [payToken, setPayToken] = useState<{
    symbol: string;
    networkId?: string;
    isPicked: boolean;
  }>();
  // Comparing a kind, Pay with stays on one token as the cards change: the
  // window's own (the wallet's largest holding, from the home's Earn
  // button), or the kind's largest holding when the comparison began. Each
  // card then says whether a swap comes first, instead of Pay with following
  // the cards onto a token the wallet holds a trace of
  const [classPaySymbol, setClassPaySymbol] = useState(
    pickedClass ? symbol : undefined,
  );
  // The router's Pay with spans every network: a token elsewhere is
  // bridged to the offer's network first
  const isAcrossNetworks = Boolean(networkAssets);
  const payWith = useMemo<IManagePositionPayWith>(
    () => ({
      preferDepositToken: Boolean(amount),
      selectedKey: payKey,
      onSelectedKeyChange: setPayKey,
      preferSymbol: pickedClass ? classPaySymbol : undefined,
      pickerHeight: payWithPickerHeight,
      onTokenChange: setPayToken,
      acrossNetworks: isAcrossNetworks,
    }),
    [
      amount,
      classPaySymbol,
      isAcrossNetworks,
      payKey,
      payWithPickerHeight,
      pickedClass,
    ],
  );
  // The networks the wallet holds a token on, the most valuable first, as
  // Pay with orders its list
  const heldNetworksOf = useCallback(
    (paySymbol: string) =>
      (tokenBySymbol.get(paySymbol.toLowerCase())?.networks ?? [])
        .filter((item) => new BigNumber(item.balance ?? 0).gt(0))
        .toSorted((a, b) => (b.fiatValue ?? 0) - (a.fiatValue ?? 0))
        .map((item) => item.id),
    [tokenBySymbol],
  );
  // What a card's form pays with, as its Pay with picks for it: the token
  // picked there; else the card's own token (comparing a kind, the kind's
  // largest holding), where the wallet holds most of it, or on the card's
  // network where the form keeps to it (an amount to start on, held there).
  // Nothing of it held: the form's own choice, the same for every card
  const payPlaceOf = useCallback(
    (
      offer: IEarnDesktopHoldOffer,
    ): { symbol: string; networkId?: string } | undefined => {
      if (payToken?.isPicked) {
        return payToken;
      }
      const offerSymbol = getOfferSymbol(offer, tokenSymbol);
      const paySymbol = pickedClass
        ? (classPaySymbol ?? payToken?.symbol)
        : offerSymbol;
      if (!paySymbol) {
        return undefined;
      }
      const held = heldNetworksOf(paySymbol);
      if (!held.length) {
        return payToken;
      }
      const offerNetworkId = getOfferNetworkId(offer);
      const keepsCardNetwork = !pickedClass && Boolean(amount);
      return {
        symbol: paySymbol,
        networkId:
          keepsCardNetwork && held.includes(offerNetworkId)
            ? offerNetworkId
            : held[0],
      };
    },
    [
      amount,
      classPaySymbol,
      heldNetworksOf,
      payToken,
      pickedClass,
      tokenSymbol,
    ],
  );
  // What comes before a card's deposit: a bridge where Pay with's token is
  // on another network than the card's (a swap on the way if it's another
  // token too), a swap where it's another token on the card's network
  const payRouteOf = useCallback(
    (offer: IEarnDesktopHoldOffer): 'swap' | 'bridge' | undefined => {
      const place = payPlaceOf(offer);
      if (!place?.networkId) {
        return undefined;
      }
      if (place.networkId !== getOfferNetworkId(offer)) {
        return 'bridge';
      }
      const offerSymbol = getOfferSymbol(offer, tokenSymbol).toLowerCase();
      return place.symbol.toLowerCase() === offerSymbol ? undefined : 'swap';
    },
    [payPlaceOf, tokenSymbol],
  );

  // A pick in the title keeps the card it was on where the new list has
  // it: one token's card stays checked as its kind is compared, and back
  const pickId = pickedClass
    ? `class:${pickedClass}`
    : `token:${tokenSymbol.toLowerCase()}`;
  const [keyPickId, setKeyPickId] = useState(pickId);
  // What was typed, carried to a form another token starts over
  const typedAmountRef = useRef(amount ?? '');
  const [startAmount, setStartAmount] = useState(amount);
  if (keyPickId !== pickId) {
    setKeyPickId(pickId);
    setStartAmount(typedAmountRef.current || undefined);
    // A kind starts on the wallet's largest holding of it, else on what Pay
    // with showed; a token picked in Pay with stays either way
    setClassPaySymbol(
      pickedClass
        ? (largestHeldSymbol(assetTokens, pickedClass) ??
            payToken?.symbol ??
            tokenSymbol)
        : undefined,
    );
    const wasToken = keyPickId.startsWith('token:');
    if (pickedClass && wasToken && pickedKey) {
      setPickedKey(`${keyPickId.slice('token:'.length)}|${pickedKey}`);
    } else if (!pickedClass && pickedKey?.includes('|')) {
      const prefix = `${tokenSymbol.toLowerCase()}|`;
      setPickedKey(
        pickedKey.startsWith(prefix)
          ? pickedKey.slice(prefix.length)
          : undefined,
      );
    } else {
      setPickedKey(undefined);
    }
  }
  // The offer asked for, else the best rate, once both the protocol list and
  // the lending markets are in: a market paying more would otherwise take the
  // form over after it opened. The best anywhere, a bridge or a swap first
  // where it needs one (11-05, the user's A), so the home row's rate is the
  // card picked here
  const selected = useMemo(() => {
    if (!isLoaded) {
      return undefined;
    }
    return offers.find((offer) => offer.key === pickedKey) ?? offers[0];
  }, [isLoaded, offers, pickedKey]);
  const selectedSymbol = selected
    ? getOfferSymbol(selected, tokenSymbol)
    : tokenSymbol;
  const selectedLogo = logoOf(selectedSymbol) ?? logoURI;
  // Kept from then on, so a refresh that reorders close rates doesn't swap
  // the form while it is being filled
  useEffect(() => {
    if (selected && selected.key !== pickedKey) {
      setPickedKey(selected.key);
    }
  }, [pickedKey, selected]);
  const selectedKey = selected?.key;
  useEffect(() => {
    if (selectedKey) {
      onOfferChange?.(selectedKey);
    }
  }, [onOfferChange, selectedKey]);

  // The last protocol's result, shown dimmed by the next one's form until its
  // own figures are in, so a switch doesn't blank the rows
  const outcomeCarry = useMemo<{ current?: IEarnOutcome }>(() => ({}), []);
  // An offer filling another form starts it over, and the typed amount goes
  // along (typedAmountRef and startAmount above)
  const handleAmountChange = useCallback(
    (value: string) => {
      typedAmountRef.current = value;
      // A box with no amount left (emptied, or "0." after a Backspace) has
      // no figures to carry to the next protocol, nor to the next amount
      if (!new BigNumber(value).gt(0)) {
        outcomeCarry.current = undefined;
      }
      onAmountChange?.(value);
    },
    [onAmountChange, outcomeCarry],
  );
  // What went in: the form's own figure when it has one (paid in another
  // token), else the amount typed. Read as the deposit lands, with the
  // result the form showed for it
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const handleDeposited = useMemo(
    () =>
      onDeposited
        ? (deposited?: string, info?: IWithdrawSuccessInfo) => {
            const amountIn = deposited || typedAmountRef.current;
            const offer = selectedRef.current;
            onDeposited(amountIn, {
              amount: amountIn,
              symbol:
                info?.symbol ||
                (offer ? getOfferSymbol(offer, tokenSymbol) : tokenSymbol),
              target: offer ? getOfferTarget(offer) : undefined,
              outcome: outcomeCarry.current,
            });
          }
        : undefined,
    [onDeposited, outcomeCarry, tokenSymbol],
  );
  // A pick shows in the switcher's row at once and the list folds under it;
  // the form takes the pick once the list is shut. An offer that fills
  // another form swaps the one the switcher sits in, and an open list would
  // be built again mid-fold
  const [isListOpen, setIsListOpen] = useState(false);
  // The list opening reads each listed offer's form ahead, so a pick opens
  // on its own data at once
  const buildOfferParams = useOfferFormParams({
    networkId,
    symbol: tokenSymbol,
    logoURI,
    logoOf,
  });
  const warmListedOffers = useCallback(() => {
    offers.forEach((offer) => warmFormData(buildOfferParams(offer)));
  }, [buildOfferParams, offers]);
  const [listedWithout, setListedWithout] = useState<string>();
  const shownRowKeyRef = useRef<string | undefined>(undefined);
  const [shownKey, setShownKey] = useState<string>();
  const shown = useMemo(
    () => offers.find((offer) => offer.key === shownKey) ?? selected,
    [offers, selected, shownKey],
  );
  const applyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(applyTimerRef.current), []);
  const handleListOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setListedWithout(shown?.key);
        setIsListOpen(true);
        warmListedOffers();
        return;
      }
      setIsListOpen(false);
    },
    [shown?.key, warmListedOffers],
  );
  const handleSelect = useCallback((offer: IEarnDesktopHoldOffer) => {
    setShownKey(offer.key);
    setIsListOpen(false);
    clearTimeout(applyTimerRef.current);
    applyTimerRef.current = setTimeout(() => {
      easeModalHeightChanges();
      setStartAmount(typedAmountRef.current || undefined);
      setPickedKey(offer.key);
    }, LIST_PICK_APPLY_MS);
  }, []);

  // Every offer in view: a pick goes to the form at once, with what was typed
  const handleRoutePick = useCallback((offer: IEarnDesktopHoldOffer) => {
    if (offer.key === selectedRef.current?.key) {
      return;
    }
    setShownKey(offer.key);
    easeModalHeightChanges();
    setStartAmount(typedAmountRef.current || undefined);
    setPickedKey(offer.key);
  }, []);
  const warmOffer = useCallback(
    (offer: IEarnDesktopHoldOffer) => warmFormData(buildOfferParams(offer)),
    [buildOfferParams],
  );

  // One token's offers: its kind on this network where another token of it
  // pays more, enough to be worth a swap
  const tokenKind = tokenBySymbol.get(tokenSymbol.toLowerCase())?.type;
  const classHint = useMemo(() => {
    if (pickedClass || offerOnly || !onAssetPickChange || !assetTokens) {
      return undefined;
    }
    if (!tokenKind || tokenKind === 'other') {
      return undefined;
    }
    const kindTokens = scopedTokens.filter((token) => token.type === tokenKind);
    if (kindTokens.length < 2) {
      return undefined;
    }
    const best = Math.max(...kindTokens.map((token) => token.rate ?? 0));
    const own = offers[0]?.apr ?? 0;
    if (best - own < BETTER_RATE_MIN_GAIN) {
      return undefined;
    }
    return {
      assetClass: tokenKind,
      rate: best,
      logos: kindTokens
        .toSorted((a, b) => (b.rate ?? 0) - (a.rate ?? 0))
        .map((token) => token.logoURI),
    };
  }, [
    assetTokens,
    offerOnly,
    offers,
    onAssetPickChange,
    pickedClass,
    scopedTokens,
    tokenKind,
  ]);
  const handleClassHint = useCallback(() => {
    if (!classHint) {
      return;
    }
    easeModalHeightChanges();
    onAssetPickChange?.({
      kind: 'class',
      assetClass: classHint.assetClass,
      networkId: scopeNetworkId,
    });
  }, [classHint, onAssetPickChange, scopeNetworkId]);
  const tokenOf = useCallback(
    (offer: IEarnDesktopHoldOffer) => {
      const offerSymbol = getOfferSymbol(offer, tokenSymbol);
      return { symbol: offerSymbol, logoURI: logoOf(offerSymbol) };
    },
    [logoOf, tokenSymbol],
  );

  // What the portfolio holds in each offer, for the picked card's facts
  const [portfolioCache] = useEarnPortfolioInvestmentsAtom();
  const earnAccountKey = useEarnAccountKey();
  const portfolioDeposits = useMemo(
    () =>
      sumPortfolioDeposits(
        (earnAccountKey ? portfolioCache[earnAccountKey] : undefined) ?? [],
      ),
    [earnAccountKey, portfolioCache],
  );
  // The picked card's Details: the window closes and the offer's details
  // page opens, its form on what was typed here and Pay with's token
  const navigation = useAppNavigation();
  const { activeAccount: detailsAccount } = useActiveAccount({ num: 0 });
  const payKeyRef = useRef(payKey);
  payKeyRef.current = payKey;
  const handleOpenDetails = useCallback(
    (offer: IEarnDesktopHoldOffer) => {
      const typed = typedAmountRef.current;
      const carried = {
        amount: new BigNumber(typed).gt(0) ? typed : undefined,
        payKey: payKeyRef.current,
      };
      onLeaveForDetails?.(
        offer.kind === 'lending'
          ? ETabEarnRoutes.EarnLendingDetails
          : ETabEarnRoutes.EarnProtocolDetails,
        {
          offerKey: offer.key,
          networkId: getOfferNetworkId(offer),
          ...carried,
        },
      );
      navigation.popStack();
      if (offer.kind === 'lending') {
        const { offer: lending } = offer;
        EarnNavigation.pushToEarnLendingDetails(navigation, {
          networkId: lending.market.networkId,
          provider: lending.market.provider,
          marketAddress: lending.market.marketAddress,
          reserveAddress: lending.reserveAddress,
          symbol: lending.symbol,
          logoURI: lending.logoURI,
          accountId: detailsAccount.account?.id,
          indexedAccountId: detailsAccount.indexedAccount?.id,
          ...carried,
        });
        return;
      }
      const offerSymbol = getOfferSymbol(offer, tokenSymbol);
      const providerName = offer.item.provider.name;
      void EarnNavigation.pushToEarnProtocolDetails(navigation, {
        networkId: offer.item.network.networkId,
        symbol: offerSymbol,
        provider: providerName,
        vault: earnUtils.shouldSendEarnProtocolVault({ providerName })
          ? offer.item.provider.vault
          : undefined,
        logoURI: logoOf(offerSymbol) ?? logoURI,
        ...carried,
      });
    },
    [
      detailsAccount.account?.id,
      detailsAccount.indexedAccount?.id,
      logoOf,
      logoURI,
      navigation,
      onLeaveForDetails,
      tokenSymbol,
    ],
  );
  const renderFacts = useCallback(
    (offer: IEarnDesktopHoldOffer, isSelected: boolean) => (
      <EarnOfferFacts
        offer={offer}
        symbol={tokenSymbol}
        isShown={isSelected}
        depositedFiatValue={
          offer.kind === 'lending'
            ? offer.offer.depositedFiatValue
            : findPositionDeposit(portfolioDeposits, {
                provider: offer.item.provider.name,
                networkId: offer.item.network.networkId,
                symbol: getOfferSymbol(offer, tokenSymbol),
                vault: offer.item.provider.vault,
              })
        }
        onDetails={handleOpenDetails}
      />
    ),
    [handleOpenDetails, portfolioDeposits, tokenSymbol],
  );

  const { gtLg } = useMedia();
  // The full router lists its offers whatever their number
  const listsRoutes =
    offersLayout === 'routes' &&
    (offers.length > 1 || Boolean(classHint) || routesBeside);
  // Beside the form only where the modal is wide and the window holds it;
  // under the amount box otherwise
  const isRoutesBeside = listsRoutes && routesBeside && gtLg;
  const routes = listsRoutes ? (
    <EarnOfferRoutes
      offers={offers}
      selectedKey={selected?.key}
      networkLogoURI={network?.logoURI}
      // Comparing a kind of token, each card names its own
      tokenOf={pickedClass ? tokenOf : undefined}
      payRouteOf={networkAssets ? payRouteOf : undefined}
      showsNetwork={Boolean(networkAssets) && !scopeNetworkId}
      footer={
        classHint ? (
          <EarnClassHint
            label={getEarnAssetClassLabel(intl, classHint.assetClass)}
            logos={classHint.logos}
            rate={classHint.rate}
            onPress={handleClassHint}
          />
        ) : null
      }
      renderFacts={renderFacts}
      onSelect={handleRoutePick}
      onHoverIn={warmOffer}
    />
  ) : null;
  let offerSwitch: ReactNode = null;
  if (isRoutesBeside) {
    offerSwitch = ROUTES_BESIDE_SLOT;
  } else if (listsRoutes) {
    offerSwitch = routes;
  } else if (shown) {
    offerSwitch = (
      <EarnOfferSwitcher
        offers={offers}
        selected={shown}
        networkLogoURI={network?.logoURI}
        isOpen={isListOpen}
        listedWithout={listedWithout}
        shownRowKeyRef={shownRowKeyRef}
        onOpenChange={handleListOpenChange}
        onSelect={handleSelect}
      />
    );
  }

  const hasNoOffers = isLoaded && !offers.length;
  // The pick heads the form, over the amount it is paid with
  const pickRow = pickPill ? (
    <XStack px="$5" pt="$2.5" pb="$1">
      {pickPill}
    </XStack>
  ) : null;
  // The form's place and the offers' column, as they will land, filling the
  // window's fixed size. The pick heads both, so the offers start level with
  // the amount box. Each column scrolls by itself: the offers move under the
  // pointer while the form and its button, under it as on Swap, stay
  const besideForm = (form: ReactNode, column: ReactNode) => (
    <YStack flex={1}>
      {pickRow}
      <XStack flex={1} ai="stretch">
        <ScrollView
          flex={1}
          minWidth={0}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <EarnFormActionPlacementContext.Provider value="inline">
            {form}
          </EarnFormActionPlacementContext.Provider>
        </ScrollView>
        <ScrollView
          testID="earn-offer-routes-column"
          w={EARN_OFFER_ROUTES_COLUMN_WIDTH}
          flexShrink={0}
        >
          {/* The form's own top space, so the first offer meets the box */}
          <YStack pt="$2.5" pb="$5" pr="$5">
            {column}
          </YStack>
        </ScrollView>
      </XStack>
    </YStack>
  );
  const withPick = (form: ReactNode) =>
    pickRow ? (
      <YStack>
        {pickRow}
        {form}
      </YStack>
    ) : (
      form
    );
  if (hasNoOffers) {
    // The pick stays, to pick another
    return withPick(
      <YStack px="$5" py="$10" ai="center">
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_no_data })}
        </SizableText>
      </YStack>,
    );
  }
  if (!selected) {
    const shell = (
      <ManageSectionShell
        type={EManagePositionType.Staking}
        symbol={selectedSymbol}
        fallbackTokenImageUri={selectedLogo}
        isPendleProvider={false}
        hasProtocolSwitch={!(routesBeside && gtLg)}
        isInModalContext
        depositOnly
        hasPayWith
        liftsHeaderControls
      />
    );
    return routesBeside && gtLg
      ? besideForm(
          shell,
          <YStack gap="$2">
            {[0, 1, 2].map((index) => (
              <Skeleton
                key={index}
                h={EARN_OFFER_OPTION_HEIGHT}
                w="100%"
                borderRadius="$3"
              />
            ))}
          </YStack>,
        )
      : withPick(shell);
  }
  const form = (
    <EarnFormSwitchingContext.Provider value={shown?.key !== selected.key}>
      <EarnOutcomeCarryContext.Provider value={outcomeCarry}>
        <OfferDepositForm
          // Another network's offer starts the form over on its network
          key={`${getOfferNetworkId(selected)}|${getOfferFormKind(
            selected,
            selectedSymbol,
          )}`}
          offer={selected}
          symbol={selectedSymbol}
          networkId={getOfferNetworkId(selected) || networkId}
          logoURI={selectedLogo}
          logoOf={logoOf}
          initialAmount={startAmount}
          payWith={payWith}
          offerSwitch={offerSwitch}
          onAmountChange={handleAmountChange}
          onHeaderRightChange={onHeaderRightChange}
          onDeposited={handleDeposited}
          footerActionOverride={footerActionOverride}
        />
      </EarnOutcomeCarryContext.Provider>
    </EarnFormSwitchingContext.Provider>
  );
  return isRoutesBeside ? besideForm(form, routes) : withPick(form);
}
