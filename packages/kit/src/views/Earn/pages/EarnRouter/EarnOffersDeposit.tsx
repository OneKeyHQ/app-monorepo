import type { ReactNode, RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IElement } from '@onekeyhq/components';
import {
  Popover,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';

import {
  ProtocolSwitchRow,
  getProtocolAprDisplay,
} from '../../../Staking/components/UniversalStake';
import { useEarnAccount } from '../../../Staking/hooks/useEarnAccount';
import {
  ManagePositionContent,
  ManageSectionShell,
} from '../../../Staking/pages/ManagePosition/components/ManagePositionContent';
import { EManagePositionType } from '../../../Staking/pages/ManagePosition/hooks/useManagePage';
import { buildKeyboardPressProps } from '../../components/desktopHome/earnDesktopPressable';
import { EarnAprSuffixText } from '../../components/EarnAprSuffixText';

import {
  OfferSummary,
  getOfferLogo,
  getOfferName,
  getOfferSubtitle,
  getOfferTvl,
  useEarnRouterOffers,
} from './EarnRouterOffer';

import type { IHeaderRightViewProps } from '../../../Staking/pages/ManagePosition/components/HeaderRight';
import type { IManagePositionPayWith } from '../../../Staking/pages/ManagePosition/components/ManagePositionContent';
import type { IEarnDesktopHoldOffer } from '../../components/desktopHome/earnDesktopHome.utils';

// An item of the protocol switcher's list, for an offer
function OfferSwitcherItem({
  offer,
  networkLogoURI,
  isSelected,
  onSelect,
  focusSelectedRef,
}: {
  offer: IEarnDesktopHoldOffer;
  networkLogoURI?: string;
  isSelected: boolean;
  onSelect: (offer: IEarnDesktopHoldOffer) => void;
  focusSelectedRef: RefObject<boolean>;
}) {
  const handlePress = useCallback(() => onSelect(offer), [offer, onSelect]);
  const rowRef = useRef<IElement>(null);
  // Opened from the keyboard, the chosen offer takes focus: the list leaves
  // it on the row that opened it
  useEffect(() => {
    if (isSelected && focusSelectedRef.current) {
      focusSelectedRef.current = false;
      rowRef.current?.focus();
    }
  }, [focusSelectedRef, isSelected]);
  return (
    <XStack
      ref={rowRef}
      testID={`earn-offer-${offer.key}`}
      role="button"
      aria-pressed={isSelected}
      userSelect="none"
      alignItems="center"
      gap="$3"
      px="$2"
      py="$2"
      mx="$1"
      borderRadius="$2"
      bg={isSelected ? '$bgActive' : '$transparent'}
      hoverStyle={{ bg: isSelected ? '$bgActive' : '$bgHover' }}
      pressStyle={{ bg: isSelected ? '$bgActive' : '$bgHover' }}
      onPress={handlePress}
      {...buildKeyboardPressProps(handlePress)}
    >
      <OfferSummary offer={offer} networkLogoURI={networkLogoURI} />
    </XStack>
  );
}

// The rate as the protocol switcher's row writes it: with its unit, and
// struck through when the protocol no longer pays it
function OfferSwitchRate({ offer }: { offer: IEarnDesktopHoldOffer }) {
  if (offer.kind === 'lending') {
    return (
      <EarnAprSuffixText
        text={`${new BigNumber(offer.offer.apy).toFixed(2)}% APY`}
        size="$headingLg"
      />
    );
  }
  const display = getProtocolAprDisplay({ protocol: offer.item });
  if (!display) {
    return null;
  }
  return display.textDecorationLine === 'line-through' ? (
    <SizableText
      size="$headingLg"
      color={display.color}
      textDecorationLine="line-through"
    >
      {display.text}
    </SizableText>
  ) : (
    <EarnAprSuffixText
      text={display.text}
      size="$headingLg"
      color={display.color}
    />
  );
}

// The deposit modal's protocol switcher, for the token's offers on one
// network: lending markets and Fixed Income among them. With one offer it is
// the row alone, naming the protocol a position's modal is for
export function EarnOfferSwitcher({
  offers,
  selected,
  networkLogoURI,
  onSelect,
}: {
  offers: IEarnDesktopHoldOffer[];
  selected: IEarnDesktopHoldOffer;
  networkLogoURI?: string;
  onSelect?: (offer: IEarnDesktopHoldOffer) => void;
}) {
  const intl = useIntl();
  const media = useMedia();
  const [isOpen, setIsOpen] = useState(false);
  const focusSelectedRef = useRef(false);
  const canSwitch = offers.length > 1;
  const handleKeyboardOpen = useCallback(() => {
    focusSelectedRef.current = true;
    setIsOpen(true);
  }, []);
  const tvl = getOfferTvl(selected);
  const trigger = (
    <ProtocolSwitchRow
      testID="earn-offer-switch"
      logoURI={getOfferLogo(selected)}
      networkLogoURI={networkLogoURI}
      name={getOfferName(selected)}
      subtitle={getOfferSubtitle(selected)}
      aprElement={<OfferSwitchRate offer={selected} />}
      tvlText={tvl || undefined}
      isSwitchEnabled={canSwitch}
      showChevron={canSwitch}
      // The Popover around it does the opening
      onPress={() => {}}
      keyboardProps={buildKeyboardPressProps(
        canSwitch ? handleKeyboardOpen : undefined,
      )}
    />
  );
  if (!canSwitch) {
    return trigger;
  }
  return (
    <Popover
      title={intl.formatMessage({ id: ETranslations.defi_select_protocol })}
      placement="bottom-end"
      open={isOpen}
      onOpenChange={setIsOpen}
      renderTrigger={trigger}
      floatingPanelProps={{ w: 360, p: '$0' }}
      renderContent={({ closePopover }) => (
        <YStack
          gap="$1"
          minHeight={90}
          {...(media.gtMd ? { p: '$1', pb: '$2' } : { px: '$3', pb: '$8' })}
        >
          <YStack gap="$0.5">
            {offers.map((offer) => (
              <OfferSwitcherItem
                key={offer.key}
                offer={offer}
                networkLogoURI={networkLogoURI}
                isSelected={offer.key === selected.key}
                onSelect={(next) => {
                  onSelect?.(next);
                  closePopover();
                }}
                focusSelectedRef={focusSelectedRef}
              />
            ))}
          </YStack>
        </YStack>
      )}
    />
  );
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
}: {
  symbol: string;
  networkId: string;
  logoURI?: string;
  offerKey?: string;
  // An amount of the token itself to start on (what a withdrawal took out)
  amount?: string;
  onHeaderRightChange?: (view: IHeaderRightViewProps | null) => void;
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

  // Each offer starts its form over; what was typed goes with it
  const typedAmountRef = useRef(amount ?? '');
  const [startAmount, setStartAmount] = useState(amount);
  const handleAmountChange = useCallback((value: string) => {
    typedAmountRef.current = value;
  }, []);
  const handleSelect = useCallback((offer: IEarnDesktopHoldOffer) => {
    setStartAmount(typedAmountRef.current || undefined);
    setPickedKey(offer.key);
  }, []);

  const offerSwitch = selected ? (
    <EarnOfferSwitcher
      offers={offers}
      selected={selected}
      networkLogoURI={network?.logoURI}
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
      key={selected.key}
      offer={selected}
      symbol={symbol}
      networkId={networkId}
      logoURI={logoURI}
      initialAmount={startAmount}
      payWith={payWith}
      offerSwitch={offerSwitch}
      onAmountChange={handleAmountChange}
      onHeaderRightChange={onHeaderRightChange}
    />
  );
}
