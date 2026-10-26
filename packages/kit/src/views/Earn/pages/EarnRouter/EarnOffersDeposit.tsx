import type { ReactNode, RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import type { IElement } from '@onekeyhq/components';
import { Accordion, SizableText, YStack } from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';

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
import { buildKeyboardPressProps } from '../../components/desktopHome/earnDesktopPressable';
import {
  LIST_PICK_APPLY_MS,
  getListHeightTransition,
  getListRowMotion,
} from '../../utils/earnListMotion';

import {
  buildOfferRowProps,
  getOfferTarget,
  useEarnRouterOffers,
} from './EarnRouterOffer';
import { useEscapeFoldsList } from './useEscapeFoldsList';
import { warmFormData } from './useWarmOffersDeposit';

import type { IEarnDepositDoneInfo } from './EarnDepositDone';
import type { IEarnOutcome } from '../../../Staking/components/UniversalStake/EarnFormSummary';
import type { IHeaderRightViewProps } from '../../../Staking/pages/ManagePosition/components/HeaderRight';
import type {
  IManagePositionFooterAction,
  IManagePositionPayWith,
} from '../../../Staking/pages/ManagePosition/components/ManagePositionContent';
import type { IWithdrawSuccessInfo } from '../../../Staking/pages/ManagePosition/components/WithdrawSection';
import type { IEarnDesktopHoldOffer } from '../../components/desktopHome/earnDesktopHome.utils';

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
        {...buildOfferRowProps(offer)}
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
      {...buildOfferRowProps(selected)}
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
}: {
  networkId: string;
  symbol: string;
  logoURI?: string;
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
      if (offer.kind === 'lending') {
        const { offer: lending } = offer;
        return {
          networkId,
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
          fallbackTokenImageUri: logoURI ?? lending.logoURI,
        };
      }
      const providerName = offer.item.provider.name;
      return {
        networkId,
        symbol,
        provider: providerName,
        vault: earnUtils.shouldSendEarnProtocolVault({ providerName })
          ? offer.item.provider.vault
          : undefined,
        // Cross-network, the form takes the external wallet's account only
        accountId: selectedAccount.othersWalletAccountId || '',
        indexedAccountId,
        fallbackTokenImageUri: logoURI,
      };
    },
    [
      activeAccount.account?.id,
      earnAccount?.account?.id,
      earnAccount?.account?.indexedAccountId,
      indexedAccountId,
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
}: {
  offer: IEarnDesktopHoldOffer;
  symbol: string;
  networkId: string;
  logoURI?: string;
  initialAmount?: string;
  payWith: IManagePositionPayWith;
  offerSwitch: ReactNode;
  onAmountChange: (amount: string) => void;
  onHeaderRightChange?: (view: IHeaderRightViewProps | null) => void;
  onDeposited?: (amount?: string, info?: IWithdrawSuccessInfo) => void;
  footerActionOverride?: IManagePositionFooterAction;
}) {
  const buildParams = useOfferFormParams({ networkId, symbol, logoURI });
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
export function EarnOffersDeposit({
  symbol,
  networkId,
  logoURI,
  offerKey,
  amount,
  onHeaderRightChange,
  onDeposited,
  footerActionOverride,
  onAmountChange,
  onOfferChange,
  payWithPickerHeight,
}: {
  symbol: string;
  networkId: string;
  logoURI?: string;
  offerKey?: string;
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
}) {
  const intl = useIntl();
  const { offers, isLoaded } = useEarnRouterOffers({ symbol, networkId });
  const { result: network } = usePromiseResult(
    () => backgroundApiProxy.serviceNetwork.getNetworkSafe({ networkId }),
    [networkId],
  );

  // Sent with an amount of the token itself, Pay with starts on that token
  // even before the withdrawal lands in the wallet
  const [payKey, setPayKey] = useState<string>();
  const payWith = useMemo<IManagePositionPayWith>(
    () => ({
      preferDepositToken: Boolean(amount),
      selectedKey: payKey,
      onSelectedKeyChange: setPayKey,
      pickerHeight: payWithPickerHeight,
    }),
    [amount, payKey, payWithPickerHeight],
  );

  const [pickedKey, setPickedKey] = useState(offerKey);
  // The offer asked for, else the best rate, once both the protocol list and
  // the lending markets are in: a market paying more would otherwise take the
  // form over after it opened
  const selected = useMemo(
    () =>
      isLoaded
        ? (offers.find((offer) => offer.key === pickedKey) ?? offers[0])
        : undefined,
    [isLoaded, offers, pickedKey],
  );
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
  // An offer filling another form starts it over; what was typed goes with it
  const typedAmountRef = useRef(amount ?? '');
  const [startAmount, setStartAmount] = useState(amount);
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
              symbol: info?.symbol || symbol,
              target: offer ? getOfferTarget(offer) : undefined,
              outcome: outcomeCarry.current,
            });
          }
        : undefined,
    [onDeposited, outcomeCarry, symbol],
  );
  // A pick shows in the switcher's row at once and the list folds under it;
  // the form takes the pick once the list is shut. An offer that fills
  // another form swaps the one the switcher sits in, and an open list would
  // be built again mid-fold
  const [isListOpen, setIsListOpen] = useState(false);
  // The list opening reads each listed offer's form ahead, so a pick opens
  // on its own data at once
  const buildOfferParams = useOfferFormParams({ networkId, symbol, logoURI });
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

  const offerSwitch = shown ? (
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
  ) : null;

  if (isLoaded && !offers.length) {
    return (
      <YStack px="$5" py="$10" ai="center">
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_no_data })}
        </SizableText>
      </YStack>
    );
  }
  if (!selected) {
    return (
      <ManageSectionShell
        type={EManagePositionType.Staking}
        symbol={symbol}
        fallbackTokenImageUri={logoURI}
        isPendleProvider={false}
        hasProtocolSwitch
        isInModalContext
        depositOnly
        hasPayWith
        liftsHeaderControls
      />
    );
  }
  return (
    <EarnFormSwitchingContext.Provider value={shown?.key !== selected.key}>
      <EarnOutcomeCarryContext.Provider value={outcomeCarry}>
        <OfferDepositForm
          key={getOfferFormKind(selected, symbol)}
          offer={selected}
          symbol={symbol}
          networkId={networkId}
          logoURI={logoURI}
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
}
