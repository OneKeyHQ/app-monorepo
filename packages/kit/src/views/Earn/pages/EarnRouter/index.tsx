import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
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
import { getEarnProviderDisplayName } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import {
  ProtocolImage,
  formatTvl,
} from '../../../Staking/components/ProtocolDisplayShared';
import { useEarnAccount } from '../../../Staking/hooks/useEarnAccount';
import { ManagePositionContent } from '../../../Staking/pages/ManagePosition/components/ManagePositionContent';
import { EManagePositionType } from '../../../Staking/pages/ManagePosition/hooks/useManagePage';
import {
  collectLendingOffers,
  collectNetworkOffers,
} from '../../components/desktopHome/earnDesktopHome.utils';
import { buildKeyboardPressProps } from '../../components/desktopHome/earnDesktopPressable';
import { useEarnDesktopMarkets } from '../../components/desktopHome/useEarnDesktopHomeData';
import { EarnAprSuffixText } from '../../components/EarnAprSuffixText';
import { EarnPageContainer } from '../../components/EarnPageContainer';
import { getProtocolAprText } from '../../components/showProtocolListDialog';
import { getProtocolAprColor } from '../../components/showProtocolListDialog.utils';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { EarnNavigation } from '../../earnUtils';

import type { IEarnDesktopHoldOffer } from '../../components/desktopHome/earnDesktopHome.utils';
import type { RouteProp } from '@react-navigation/core';

// The deposit form keeps the width the protocol details page gives it
const FORM_WIDTH = 440;
const EMPTY_OFFERS: IEarnDesktopHoldOffer[] = [];

type IRouteProps = RouteProp<ITabEarnParamList, ETabEarnRoutes.EarnRouter>;

// What the token earns on this network: the protocol list and the lending
// markets' supply, the best rate first, as the home's row counted them
function useEarnRouterOffers({
  symbol,
  networkId,
}: {
  symbol: string;
  networkId: string;
}) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const accountId = activeAccount.account?.id;
  const accountNetworkId = activeAccount.network?.id;
  const { result: protocols } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking
        .getProtocolList({ symbol, accountId, networkId: accountNetworkId })
        .catch(() => [] as IStakeProtocolListItem[]),
    [accountId, accountNetworkId, symbol],
  );
  const { markets, isLoaded: isMarketsLoaded } = useEarnDesktopMarkets({
    isActive: true,
  });
  const offers = useMemo(() => {
    if (!protocols) {
      return EMPTY_OFFERS;
    }
    return collectNetworkOffers({
      networkId,
      protocols,
      lendingOffers:
        collectLendingOffers({ markets }).get(symbol.toLowerCase()) ?? [],
    });
  }, [markets, networkId, protocols, symbol]);
  return { offers, isLoaded: Boolean(protocols) && isMarketsLoaded };
}

const getOfferName = (offer: IEarnDesktopHoldOffer) =>
  offer.kind === 'lending'
    ? offer.offer.marketLabel
    : getEarnProviderDisplayName(offer.item.provider.name);

const getOfferLogo = (offer: IEarnDesktopHoldOffer) =>
  offer.kind === 'lending'
    ? offer.offer.market.logoURI
    : offer.item.provider.logoURI;

// A vault names itself; a fixed rate says when it matures
const getOfferSubtitle = (offer: IEarnDesktopHoldOffer) => {
  if (offer.kind === 'lending') {
    return undefined;
  }
  return offer.isFixedRate
    ? offer.item.provider.maturity
    : offer.item.provider.vaultName;
};

const getOfferTvl = (offer: IEarnDesktopHoldOffer) =>
  offer.kind === 'lending'
    ? offer.offer.tvlText
    : formatTvl(offer.item.provider.tvl);

function OfferRate({ offer }: { offer: IEarnDesktopHoldOffer }) {
  if (offer.kind === 'lending') {
    return (
      <EarnAprSuffixText
        text={`${new BigNumber(offer.offer.apy).toFixed(2)}%`}
      />
    );
  }
  return (
    <EarnAprSuffixText
      text={getProtocolAprText(offer.item)}
      color={getProtocolAprColor(offer.item.aprInfo)}
    />
  );
}

// The protocol switcher's item, so the list reads like the one the deposit
// modal opens
function OfferSummary({ offer }: { offer: IEarnDesktopHoldOffer }) {
  const intl = useIntl();
  const subtitle = getOfferSubtitle(offer);
  const tvl = getOfferTvl(offer);
  return (
    <>
      <ProtocolImage logoURI={getOfferLogo(offer)} />
      <YStack flex={1} minWidth={0} gap="$0.5">
        <XStack ai="center" gap="$1.5" minWidth={0}>
          <SizableText size="$bodyLgMedium" numberOfLines={1} flexShrink={1}>
            {getOfferName(offer)}
          </SizableText>
          {offer.isFixedRate ? (
            <Badge badgeType="default" badgeSize="sm">
              <Badge.Text>
                {intl.formatMessage({ id: ETranslations.defi_fixed_rate })}
              </Badge.Text>
            </Badge>
          ) : null}
          {offer.kind === 'protocol'
            ? offer.item.provider.badges?.map((badge) => (
                <Badge
                  key={badge.tag}
                  badgeType={badge.badgeType}
                  badgeSize="sm"
                >
                  <Badge.Text>{badge.tag}</Badge.Text>
                </Badge>
              ))
            : null}
        </XStack>
        {subtitle ? (
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {subtitle}
          </SizableText>
        ) : null}
      </YStack>
      <YStack ai="flex-end" gap="$0.5" flexShrink={0}>
        <OfferRate offer={offer} />
        {tvl ? (
          <SizableText size="$bodySm" color="$textSubdued">
            {`TVL ${tvl}`}
          </SizableText>
        ) : null}
      </YStack>
    </>
  );
}

function OfferRow({
  offer,
  isSelected,
  onSelect,
}: {
  offer: IEarnDesktopHoldOffer;
  isSelected: boolean;
  onSelect: (offer: IEarnDesktopHoldOffer) => void;
}) {
  const handlePress = useCallback(() => onSelect(offer), [offer, onSelect]);
  return (
    <XStack
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
}: {
  offers: IEarnDesktopHoldOffer[];
  isLoaded: boolean;
  selectedKey?: string;
  onSelect: (offer: IEarnDesktopHoldOffer) => void;
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
          />
        </YStack>
      )}
    />
  );
}

// The deposit side of the manage form, for whichever offer is chosen
function OfferDepositForm({
  offer,
  symbol,
  networkId,
  logoURI,
}: {
  offer: IEarnDesktopHoldOffer;
  symbol: string;
  networkId: string;
  logoURI?: string;
}) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { selectedAccount } = useSelectedAccount({ num: 0 });
  const indexedAccountId =
    selectedAccount.indexedAccountId || activeAccount.indexedAccount?.id;
  // Lending supply goes through the market's own account on this network,
  // as the Borrow pages pass it
  const { earnAccount } = useEarnAccount({
    networkId,
    accountId: activeAccount.account?.id,
    indexedAccountId,
  });

  if (offer.kind === 'lending') {
    const { offer: lending } = offer;
    return (
      <ManagePositionContent
        depositOnly
        type={EManagePositionType.Supply}
        networkId={networkId}
        symbol={lending.symbol}
        provider={lending.market.provider}
        marketAddress={lending.market.marketAddress}
        reserveAddress={lending.reserveAddress}
        accountId={earnAccount?.account?.id || activeAccount.account?.id || ''}
        indexedAccountId={
          earnAccount?.account?.indexedAccountId ?? indexedAccountId
        }
        fallbackTokenImageUri={logoURI ?? lending.logoURI}
        providerDisplayName={lending.marketLabel}
        providerLogoUri={lending.market.logoURI}
      />
    );
  }
  const { item } = offer;
  return (
    <ManagePositionContent
      depositOnly
      networkId={networkId}
      symbol={symbol}
      provider={item.provider.name}
      vault={
        earnUtils.shouldSendEarnProtocolVault({
          providerName: item.provider.name,
        })
          ? item.provider.vault
          : undefined
      }
      // Cross-network, the form takes the external wallet's account only
      accountId={selectedAccount.othersWalletAccountId || ''}
      indexedAccountId={indexedAccountId}
      fallbackTokenImageUri={logoURI}
    />
  );
}

function EarnRouterPage({ route }: { route: IRouteProps }) {
  const intl = useIntl();
  const media = useMedia();
  const navigation = useAppNavigation();
  const { symbol, networkId, logoURI, offerKey } = route.params;

  const { offers, isLoaded } = useEarnRouterOffers({ symbol, networkId });
  const [pickedKey, setPickedKey] = useState(offerKey);
  // The offer asked for, else the best rate
  const selected = useMemo(
    () => offers.find((offer) => offer.key === pickedKey) ?? offers[0],
    [offers, pickedKey],
  );
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
      offer={selected}
      symbol={symbol}
      networkId={networkId}
      logoURI={logoURI}
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
        <YStack w={FORM_WIDTH} flexShrink={0}>
          {form ?? <Skeleton mx="$5" h={320} borderRadius="$3" />}
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
        {form}
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
