import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IElement } from '@onekeyhq/components';
import {
  Icon,
  Popover,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar/NetworkAvatar';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  ETabEarnRoutes,
  ITabEarnParamList,
} from '@onekeyhq/shared/src/routes';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { useEarnAccount } from '../../../Staking/hooks/useEarnAccount';
import { ManagePositionContent } from '../../../Staking/pages/ManagePosition/components/ManagePositionContent';
import { EManagePositionType } from '../../../Staking/pages/ManagePosition/hooks/useManagePage';
import { buildKeyboardPressProps } from '../../components/desktopHome/earnDesktopPressable';
import { EarnPageContainer } from '../../components/EarnPageContainer';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { EarnNavigation } from '../../earnUtils';

import { OfferSummary, useEarnRouterOffers } from './EarnRouterOffer';

import type { IManagePositionPayWith } from '../../../Staking/pages/ManagePosition/components/ManagePositionContent';
import type { IEarnDesktopHoldOffer } from '../../components/desktopHome/earnDesktopHome.utils';
import type { RouteProp } from '@react-navigation/core';

// The deposit form keeps the width the protocol details page gives it
const FORM_WIDTH = 440;
// and the gap between its title line and body there, which its loading
// shell copies
const FORM_GAP = '$1.5';

type IRouteProps = RouteProp<ITabEarnParamList, ETabEarnRoutes.EarnRouter>;

function OfferRow({
  offer,
  isSelected,
  onSelect,
  focusSelectedRef,
}: {
  offer: IEarnDesktopHoldOffer;
  isSelected: boolean;
  onSelect: (offer: IEarnDesktopHoldOffer) => void;
  focusSelectedRef?: RefObject<boolean>;
}) {
  const handlePress = useCallback(() => onSelect(offer), [offer, onSelect]);
  const rowRef = useRef<IElement>(null);
  useEffect(() => {
    if (isSelected && focusSelectedRef?.current) {
      focusSelectedRef.current = false;
      rowRef.current?.focus();
    }
  }, [focusSelectedRef, isSelected]);
  return (
    <XStack
      ref={rowRef}
      testID={`earn-router-offer-${offer.key}`}
      role="button"
      aria-pressed={isSelected}
      ai="center"
      gap="$3"
      px="$3"
      py="$2.5"
      borderRadius="$3"
      borderCurve="continuous"
      // The chosen offer keeps the hover color, as an opened row does
      bg={isSelected ? '$bgActive' : undefined}
      hoverStyle={{ bg: isSelected ? '$bgActive' : '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      cursor="pointer"
      userSelect="none"
      onPress={handlePress}
      {...buildKeyboardPressProps(handlePress)}
    >
      <OfferSummary offer={offer} />
    </XStack>
  );
}

function OfferListSkeleton() {
  return (
    <YStack>
      {Array.from({ length: 3 }).map((_, index) => (
        <XStack key={index} ai="center" gap="$3" px="$3" py="$2.5">
          <Skeleton w="$9" h="$9" borderRadius="$2" />
          <Skeleton w={140} h={18} borderRadius="$2" />
          <XStack flex={1} />
          <Skeleton w={72} h={18} borderRadius="$2" />
        </XStack>
      ))}
    </YStack>
  );
}

function OfferList({
  offers,
  isLoaded,
  selectedKey,
  onSelect,
  focusSelectedRef,
}: {
  offers: IEarnDesktopHoldOffer[];
  isLoaded: boolean;
  selectedKey?: string;
  onSelect: (offer: IEarnDesktopHoldOffer) => void;
  focusSelectedRef?: RefObject<boolean>;
}) {
  if (!isLoaded) {
    return <OfferListSkeleton />;
  }
  return (
    <YStack gap="$1">
      {offers.map((offer) => (
        <OfferRow
          key={offer.key}
          offer={offer}
          isSelected={offer.key === selectedKey}
          onSelect={onSelect}
          focusSelectedRef={focusSelectedRef}
        />
      ))}
    </YStack>
  );
}

// A phone's width: the chosen offer as one row above the form, the others in
// a sheet, the way the deposit modal switches protocols
function OfferSwitch({
  offers,
  isLoaded,
  selected,
  onSelect,
}: {
  offers: IEarnDesktopHoldOffer[];
  isLoaded: boolean;
  selected?: IEarnDesktopHoldOffer;
  onSelect: (offer: IEarnDesktopHoldOffer) => void;
}) {
  const intl = useIntl();
  const [isOpen, setIsOpen] = useState(false);
  // The sheet leaves focus on the page under it, so opened from the keyboard
  // the chosen offer in it takes focus
  const focusSelectedRef = useRef(false);
  if (!isLoaded || !selected) {
    return <Skeleton h={60} w="100%" borderRadius="$2" />;
  }
  const canSwitch = offers.length > 1;
  const trigger = (
    <XStack
      testID="earn-router-offer-switch"
      role={canSwitch ? 'button' : undefined}
      // The Popover around it does the opening
      onPress={() => {}}
      ai="center"
      gap="$3"
      px="$3"
      py="$2"
      bg="$bgSubdued"
      borderRadius="$2"
      userSelect="none"
      hoverStyle={canSwitch ? { bg: '$bgHover' } : undefined}
      pressStyle={canSwitch ? { bg: '$bgActive' } : undefined}
      // The Popover opens on a click only: a tab stop, and Enter and Space
      {...buildKeyboardPressProps(
        canSwitch
          ? () => {
              focusSelectedRef.current = true;
              setIsOpen(true);
            }
          : undefined,
      )}
    >
      <OfferSummary offer={selected} />
      {canSwitch ? (
        <Icon name="ChevronGrabberVerSolid" color="$iconSubdued" size="$5" />
      ) : null}
    </XStack>
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
        <YStack p="$2" pb="$4">
          <OfferList
            offers={offers}
            isLoaded
            selectedKey={selected.key}
            onSelect={(offer) => {
              onSelect(offer);
              closePopover();
            }}
            focusSelectedRef={focusSelectedRef}
          />
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

// The deposit side of the manage form, for whichever offer is chosen, with
// Pay with
function OfferDepositForm({
  offer,
  symbol,
  networkId,
  logoURI,
  initialAmount,
  payWith,
}: {
  offer: IEarnDesktopHoldOffer;
  symbol: string;
  networkId: string;
  logoURI?: string;
  initialAmount?: string;
  payWith: IManagePositionPayWith;
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
      {...params}
      initialAmount={initialAmount}
      providerDisplayName={
        offer.kind === 'lending' ? offer.offer.marketLabel : undefined
      }
      providerLogoUri={
        offer.kind === 'lending' ? offer.offer.market.logoURI : undefined
      }
      payWith={payWith}
    />
  );
}

function EarnRouterPage({ route }: { route: IRouteProps }) {
  const intl = useIntl();
  const media = useMedia();
  const navigation = useAppNavigation();
  const { symbol, networkId, logoURI, offerKey, amount } = route.params;

  const { offers, isLoaded } = useEarnRouterOffers({ symbol, networkId });
  // Pay with's pick stays across offers. Sent here with an amount of the
  // token itself (a withdrawal's), it starts on that token even before the
  // withdrawal lands in the wallet
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
  const handleSelect = useCallback((offer: IEarnDesktopHoldOffer) => {
    setPickedKey(offer.key);
  }, []);

  const { result: network } = usePromiseResult(
    () => backgroundApiProxy.serviceNetwork.getNetworkSafe({ networkId }),
    [networkId],
  );

  const pageTitle = useMemo(
    () => (
      <XStack gap="$3" ai="center" minWidth={0}>
        <Token size="md" tokenImageUri={logoURI} />
        <SizableText size="$headingXl" numberOfLines={1} flexShrink={1}>
          {symbol}
        </SizableText>
        {network ? (
          <XStack gap="$1.5" ai="center" flexShrink={0}>
            <NetworkAvatar networkId={networkId} size="$5" />
            <SizableText size="$bodyLg" color="$textSubdued">
              {network.name}
            </SizableText>
          </XStack>
        ) : null}
      </XStack>
    ),
    [logoURI, network, networkId, symbol],
  );

  const breadcrumbProps = useMemo(
    () => ({
      items: [
        {
          label: intl.formatMessage({ id: ETranslations.global_earn }),
          onClick: () => {
            void EarnNavigation.popToEarnHome(navigation);
          },
        },
        { label: symbol },
      ],
    }),
    [intl, navigation, symbol],
  );

  const form = selected ? (
    <OfferDepositForm
      // Each offer starts the form over, so nothing of the last one (its
      // title, history, balance) shows while the next one loads
      key={selected.key}
      offer={selected}
      symbol={symbol}
      networkId={networkId}
      logoURI={logoURI}
      initialAmount={amount}
      payWith={payWith}
    />
  ) : null;

  let body = null;
  if (isLoaded && !offers.length) {
    body = (
      <YStack px="$5" py="$10" ai="center">
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_no_data })}
        </SizableText>
      </YStack>
    );
  } else if (media.gtMd) {
    body = (
      <XStack ai="flex-start">
        <YStack w={FORM_WIDTH} flexShrink={0} gap={FORM_GAP}>
          {form ?? (
            <YStack px="$5">
              <Skeleton h={320} borderRadius="$3" />
            </YStack>
          )}
        </YStack>
        <YStack flex={1} minWidth={0} px="$5" gap="$1.5">
          {/* Sits on the form's Deposit title line */}
          <SizableText size="$headingMd" py="$1.5" px="$3">
            {intl.formatMessage({ id: ETranslations.defi_select_protocol })}
          </SizableText>
          <OfferList
            offers={offers}
            isLoaded={isLoaded}
            selectedKey={selected?.key}
            onSelect={handleSelect}
          />
        </YStack>
      </XStack>
    );
  } else {
    body = (
      <YStack gap="$4">
        <YStack px="$5">
          <OfferSwitch
            offers={offers}
            isLoaded={isLoaded}
            selected={selected}
            onSelect={handleSelect}
          />
        </YStack>
        {form ? <YStack gap={FORM_GAP}>{form}</YStack> : null}
      </YStack>
    );
  }

  return (
    <EarnPageContainer
      pageTitle={pageTitle}
      breadcrumbProps={breadcrumbProps}
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      showBackButton
      showBodyTitle
    >
      {body}
    </EarnPageContainer>
  );
}

function EarnRouterPageWithProvider(props: { route: IRouteProps }) {
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
          <EarnRouterPage {...props} />
        </DiscoveryBrowserProviderMirror>
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

export default EarnRouterPageWithProvider;
