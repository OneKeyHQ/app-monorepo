import type { ReactNode, RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

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
import { useEarnAccount } from '../../../Staking/hooks/useEarnAccount';
import {
  ManagePositionContent,
  ManageSectionShell,
} from '../../../Staking/pages/ManagePosition/components/ManagePositionContent';
import { EManagePositionType } from '../../../Staking/pages/ManagePosition/hooks/useManagePage';
import { buildKeyboardPressProps } from '../../components/desktopHome/earnDesktopPressable';

import { buildOfferRowProps, useEarnRouterOffers } from './EarnRouterOffer';

import type { IHeaderRightViewProps } from '../../../Staking/pages/ManagePosition/components/HeaderRight';
import type {
  IManagePositionFooterAction,
  IManagePositionPayWith,
} from '../../../Staking/pages/ManagePosition/components/ManagePositionContent';
import type { IEarnDesktopHoldOffer } from '../../components/desktopHome/earnDesktopHome.utils';

// An offer under the switcher's row when the list is open: the same row,
// its rate lined up with the one above, so a pick moves up into its place
// as it is
function OfferSwitcherItem({
  offer,
  networkLogoURI,
  onSelect,
  focusRef,
}: {
  offer: IEarnDesktopHoldOffer;
  networkLogoURI?: string;
  onSelect: (offer: IEarnDesktopHoldOffer) => void;
  // Set for the first row when the list opens from the keyboard
  focusRef?: RefObject<boolean>;
}) {
  const handlePress = useCallback(() => onSelect(offer), [offer, onSelect]);
  const rowRef = useRef<IElement>(null);
  useEffect(() => {
    if (focusRef?.current) {
      focusRef.current = false;
      rowRef.current?.focus();
    }
  }, [focusRef]);
  return (
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
  );
}

type IListKeyEvent = {
  key: string;
  preventDefault: () => void;
  stopPropagation: () => void;
};

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
  onOpenChange?: (isOpen: boolean) => void;
  onSelect?: (offer: IEarnDesktopHoldOffer) => void;
}) {
  const focusFirstRef = useRef(false);
  const rowRef = useRef<IElement>(null);
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
  // Escape folds an open list back to its row. The modal closes as the key
  // comes up, so the list takes that
  const handleListKeyUp = useCallback(
    (event: IListKeyEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onOpenChange?.(false);
      rowRef.current?.focus();
    },
    [onOpenChange],
  );
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
      borderRadius="$2"
      borderCurve="continuous"
      onKeyUp={isOpen ? handleListKeyUp : undefined}
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
          {row}
          <Accordion.HeightAnimator transition="quick">
            <Accordion.Content
              unstyled
              transition="quick"
              animateOnly={ANIMATE_ONLY_OPACITY}
              enterStyle={OFFER_LIST_HIDDEN_STYLE}
              exitStyle={OFFER_LIST_HIDDEN_STYLE}
            >
              {listed.map((offer, index) => (
                <OfferSwitcherItem
                  key={offer.key}
                  offer={offer}
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

// The list's fold (the quick transition, 150 ms) and a frame to spare
const APPLY_AFTER_FOLD_MS = 180;

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
  onDeposited?: (amount?: string) => void;
  footerActionOverride?: IManagePositionFooterAction;
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

  const params = useMemo<IOfferFormParams>(() => {
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
        accountId: earnAccount?.account?.id || activeAccount.account?.id || '',
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
  }, [
    activeAccount.account?.id,
    earnAccount?.account?.id,
    earnAccount?.account?.indexedAccountId,
    indexedAccountId,
    logoURI,
    networkId,
    offer,
    selectedAccount.othersWalletAccountId,
    symbol,
  ]);

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
}: {
  symbol: string;
  networkId: string;
  logoURI?: string;
  offerKey?: string;
  // An amount of the token itself to start on (what a withdrawal took out)
  amount?: string;
  onHeaderRightChange?: (view: IHeaderRightViewProps | null) => void;
  // Once the deposit is out, with what was typed, in place of closing: the
  // guide shows its last step
  onDeposited?: (amount: string) => void;
  footerActionOverride?: IManagePositionFooterAction;
  onAmountChange?: (amount: string) => void;
  // The offer the form is on, as it starts and after each switch
  onOfferChange?: (offerKey: string) => void;
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
    }),
    [amount, payKey],
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

  // An offer filling another form starts it over; what was typed goes with it
  const typedAmountRef = useRef(amount ?? '');
  const [startAmount, setStartAmount] = useState(amount);
  const handleAmountChange = useCallback(
    (value: string) => {
      typedAmountRef.current = value;
      onAmountChange?.(value);
    },
    [onAmountChange],
  );
  // What went in: the form's own figure when it has one (paid in another
  // token), else the amount typed
  const handleDeposited = useMemo(
    () =>
      onDeposited
        ? (deposited?: string) =>
            onDeposited(deposited || typedAmountRef.current)
        : undefined,
    [onDeposited],
  );
  // A pick shows in the switcher's row at once and the list folds under it;
  // the form takes the pick once the list is shut. An offer that fills
  // another form swaps the one the switcher sits in, and an open list would
  // be built again mid-fold
  const [isListOpen, setIsListOpen] = useState(false);
  const [listedWithout, setListedWithout] = useState<string>();
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
      }
      setIsListOpen(open);
    },
    [shown?.key],
  );
  const handleSelect = useCallback((offer: IEarnDesktopHoldOffer) => {
    setShownKey(offer.key);
    setIsListOpen(false);
    clearTimeout(applyTimerRef.current);
    applyTimerRef.current = setTimeout(() => {
      setStartAmount(typedAmountRef.current || undefined);
      setPickedKey(offer.key);
    }, APPLY_AFTER_FOLD_MS);
  }, []);

  const offerSwitch = shown ? (
    <EarnOfferSwitcher
      offers={offers}
      selected={shown}
      networkLogoURI={network?.logoURI}
      isOpen={isListOpen}
      listedWithout={listedWithout}
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
  );
}
