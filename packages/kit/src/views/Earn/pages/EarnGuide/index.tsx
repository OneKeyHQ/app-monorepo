import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Icon,
  Page,
  ScrollView,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAccountSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger';
import { HighlightAddress } from '@onekeyhq/kit/src/components/HighlightAddress';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { useFiatCrypto } from '../../../FiatCrypto/hooks';
import { HomeTokenListProviderMirror } from '../../../Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import {
  ReceiveCard,
  ReceiveCardCell,
} from '../../../Receive/components/ReceiveCard';
import { ReceiveQRCode } from '../../../Receive/components/ReceiveQRCode';
import { useEarnAccount } from '../../../Staking/hooks/useEarnAccount';
import { ManageSectionShell } from '../../../Staking/pages/ManagePosition/components/ManagePositionContent';
import { EManagePositionType } from '../../../Staking/pages/ManagePosition/hooks/useManagePage';
import { EARN_DESKTOP_DEMO_COPY } from '../../components/desktopHome/earnDesktopHomeCopy';
import {
  EARN_GUIDE_SUGGESTED_GAS,
  EARN_GUIDE_SYMBOL,
  getEarnGuideNetworkId,
  isGuideVaultOffer,
} from '../../components/desktopHome/earnGuide.utils';
import { EarnGuideHeader } from '../../components/desktopHome/EarnGuideHeader';
import {
  earnGuideStore,
  useEarnGuide,
} from '../../components/desktopHome/earnGuideStore';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { EarnNavigation } from '../../earnUtils';
import {
  EarnOfferSwitcher,
  EarnOffersDeposit,
} from '../EarnRouter/EarnOffersDeposit';
import { useEarnRouterOffers } from '../EarnRouter/EarnRouterOffer';

import type { IEarnDesktopHoldOffer } from '../../components/desktopHome/earnDesktopHome.utils';
import type { IEarnGuideStep } from '../../components/desktopHome/earnGuide.utils';

const copy = EARN_DESKTOP_DEMO_COPY;
const noop = () => {};
// A step that finishes on its own (the ETH lands) keeps its check on screen
// this long before the next one shows
const DONE_BEAT_MS = 900;
const GAS_POLL_MS = 8000;
// The preview's address when no wallet is connected: the demo account's
const PREVIEW_ADDRESS = '0x92bAA173828d55B2F1ed611352Aa0627AB825178';
// The preview's deposit takes about as long as a quick real one
const PREVIEW_DEPOSIT_MS = 1400;

function StepIntro({ title, body }: { title: string; body: string }) {
  return (
    <YStack gap="$2">
      <SizableText size="$headingXl">{title}</SizableText>
      <SizableText size="$bodyLg" color="$textSubdued">
        {body}
      </SizableText>
    </YStack>
  );
}

function GasStep({
  scope,
  account,
  address,
  network,
  hasWallet,
  hasGas,
  isPreview,
}: {
  scope: string;
  account?: INetworkAccount;
  address?: string;
  network?: IServerNetwork;
  hasWallet: boolean;
  hasGas: boolean;
  isPreview: boolean;
}) {
  const networkId = getEarnGuideNetworkId();
  const { copyText } = useClipboard();
  // While it waits the step checks the account itself, so the ETH shows up
  // here without the home's slower full refresh
  useEffect(() => {
    if (!account || hasGas || isPreview) {
      return undefined;
    }
    let isStopped = false;
    const check = async () => {
      try {
        const info =
          await backgroundApiProxy.serviceAccountProfile.fetchAccountNativeBalance(
            { account, networkId },
          );
        if (!isStopped) {
          earnGuideStore.setPolledGas({
            scope,
            amount: new BigNumber(info.balanceParsed ?? 0).toNumber() || 0,
          });
        }
      } catch {
        // The next check tries again
      }
    };
    void check();
    const timer = setInterval(() => void check(), GAS_POLL_MS);
    return () => {
      isStopped = true;
      clearInterval(timer);
    };
  }, [account, hasGas, isPreview, networkId, scope]);

  const shownAddress = address || (isPreview ? PREVIEW_ADDRESS : undefined);
  return (
    <YStack gap="$5">
      <StepIntro
        title={copy.guideGasTitle}
        body={copy.guideGasBody(EARN_GUIDE_SUGGESTED_GAS)}
      />
      {shownAddress ? (
        // The receive page's card: network, code, and the address that
        // copies when pressed
        <ReceiveCard
          testID="earn-guide-address"
          headerLeft={
            network ? (
              <XStack flexShrink={1} ai="center" gap="$2">
                <NetworkAvatarBase
                  logoURI={network.logoURI}
                  isCustomNetwork={network.isCustomNetwork}
                  networkName={network.name}
                  size="$5"
                />
                <SizableText size="$bodyMdMedium" numberOfLines={1}>
                  {network.name}
                </SizableText>
              </XStack>
            ) : undefined
          }
        >
          <ReceiveCardCell ai="center" jc="center" py={27} px="$4">
            <ReceiveQRCode value={shownAddress} size={176} />
          </ReceiveCardCell>
          <ReceiveCardCell>
            <XStack
              testID="earn-guide-copy-address"
              px="$4"
              py="$3"
              gap="$3"
              ai="flex-start"
              borderRadius="$2.5"
              userSelect="none"
              hoverStyle={{ bg: '$bgHover' }}
              pressStyle={{ bg: '$bgActive' }}
              focusable
              focusVisibleStyle={{
                outlineWidth: 2,
                outlineColor: '$focusRing',
                outlineOffset: 2,
                outlineStyle: 'solid',
              }}
              onPress={() => copyText(shownAddress)}
            >
              <XStack flex={1} flexWrap="wrap">
                <HighlightAddress
                  address={shownAddress}
                  size="$bodyLg"
                  fontFamily="$monoRegular"
                />
              </XStack>
              <Stack mt="$0.5" flexShrink={0}>
                <Icon name="Copy3Outline" size="$5" color="$iconSubdued" />
              </Stack>
            </XStack>
          </ReceiveCardCell>
        </ReceiveCard>
      ) : null}
      {hasWallet || isPreview ? (
        <XStack ai="center" gap="$2" testID="earn-guide-gas-status">
          {hasGas ? (
            <Icon name="CheckRadioSolid" size="$5" color="$iconSuccess" />
          ) : (
            <Spinner size="small" />
          )}
          <SizableText size="$bodyMd" color="$textSubdued">
            {hasGas ? copy.guideGasReceived : copy.guideGasWaiting}
          </SizableText>
        </XStack>
      ) : (
        <SizableText size="$bodyLg">{copy.guideConnect}</SizableText>
      )}
    </YStack>
  );
}

function VaultStep({
  offers,
  selected,
  networkLogoURI,
  isLoaded,
  onSelect,
}: {
  offers: IEarnDesktopHoldOffer[];
  selected?: IEarnDesktopHoldOffer;
  networkLogoURI?: string;
  isLoaded: boolean;
  onSelect: (offer: IEarnDesktopHoldOffer) => void;
}) {
  // The deposit modal's switcher, open as the step shows so the vaults are
  // there to choose from; a pick folds it under its row
  const [isOpen, setIsOpen] = useState(true);
  const [listedWithout, setListedWithout] = useState<string>();
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setListedWithout(selected?.key);
      }
      setIsOpen(open);
    },
    [selected?.key],
  );
  return (
    <YStack gap="$5">
      <StepIntro title={copy.guideVaultTitle} body={copy.guideVaultBody} />
      {selected ? (
        <EarnOfferSwitcher
          offers={offers}
          selected={selected}
          networkLogoURI={networkLogoURI}
          isOpen={isOpen}
          listedWithout={listedWithout ?? selected.key}
          onOpenChange={handleOpenChange}
          onSelect={(offer) => {
            onSelect(offer);
            setIsOpen(false);
          }}
        />
      ) : (
        <YStack h={64} ai="center" jc="center">
          {isLoaded ? null : <Spinner size="small" />}
        </YStack>
      )}
    </YStack>
  );
}

function DoneStep({
  offer,
  networkLogoURI,
  amount,
}: {
  offer?: IEarnDesktopHoldOffer;
  networkLogoURI?: string;
  amount?: string;
}) {
  const intl = useIntl();
  const shownAmount = new BigNumber(amount ?? '');
  return (
    <YStack gap="$5">
      <StepIntro title={copy.guideDoneTitle} body={copy.guideDoneBody} />
      {offer ? (
        <YStack gap="$3">
          <EarnOfferSwitcher
            offers={[offer]}
            selected={offer}
            networkLogoURI={networkLogoURI}
          />
          {shownAmount.gt(0) ? (
            <XStack
              testID="earn-guide-deposited"
              jc="space-between"
              ai="center"
              px="$4"
            >
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({ id: ETranslations.earn_deposited })}
              </SizableText>
              <SizableText size="$bodyMdMedium">
                {`${shownAmount.toFormat()} ${EARN_GUIDE_SYMBOL}`}
              </SizableText>
            </XStack>
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  );
}

function EarnGuidePage() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const guide = useEarnGuide();
  const { scope, saved, state, isPreview, previewAmount, live } = guide;
  const hasWallet = Boolean(live?.hasWallet);
  const networkId = getEarnGuideNetworkId();
  const { result: network } = usePromiseResult(
    () => backgroundApiProxy.serviceNetwork.getNetworkSafe({ networkId }),
    [networkId],
  );
  const { earnAccount } = useEarnAccount({ networkId });
  const address = earnAccount?.accountAddress;
  const { showAccountSelector } = useAccountSelectorTrigger({
    num: 0,
    showConnectWalletModalInDappMode: true,
  });
  const { handleFiatCrypto, isSupported: canBuy } = useFiatCrypto({
    accountId: earnAccount?.accountId ?? '',
    networkId,
    fiatCryptoType: 'buy',
  });

  // Up and down for the card and the preview key. Down as the modal starts
  // to go, not once it has faded, so the card's ghost leaves with it
  const reactNavigation = useNavigation();
  useEffect(() => {
    earnGuideStore.setModalOpen(true);
    const unsubscribe = reactNavigation.addListener('beforeRemove', () =>
      earnGuideStore.setModalOpen(false),
    );
    return () => {
      unsubscribe();
      earnGuideStore.setModalOpen(false);
    };
  }, [reactNavigation]);

  // The vault: the one picked in step 2, else the PO's example, else the
  // best rate on Base
  const { offers, isLoaded: isOffersLoaded } = useEarnRouterOffers({
    symbol: EARN_GUIDE_SYMBOL,
    networkId,
  });
  const [pickedVaultKey, setPickedVaultKey] = useState<string>();
  const vaultKey = pickedVaultKey ?? saved.vaultKey;
  const vaultOffer = useMemo(
    () =>
      offers.find((offer) => offer.key === vaultKey) ??
      offers.find(isGuideVaultOffer) ??
      offers[0],
    [offers, vaultKey],
  );

  // A step that finishes moves straight on to the next. One the user's own
  // press finished shows the next at once; one that finished by itself (the
  // ETH landing) keeps its check a moment first
  const { current } = state;
  const [picked, setPicked] = useState<IEarnGuideStep>();
  const [pinned, setPinned] = useState<IEarnGuideStep>();
  const isLocalRef = useRef(false);
  const previousRef = useRef(current);
  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = current;
    if (previous === current) {
      return undefined;
    }
    setPicked(undefined);
    if (isLocalRef.current || current < previous) {
      isLocalRef.current = false;
      setPinned(undefined);
      return undefined;
    }
    setPinned(previous);
    const timer = setTimeout(() => setPinned(undefined), DONE_BEAT_MS);
    return () => clearTimeout(timer);
  }, [current]);
  const shownStep = pinned ?? picked ?? current;
  const hasGas = state.done[0];

  const handleClose = useCallback(() => {
    navigation.pop();
  }, [navigation]);
  const handleHide = useCallback(() => {
    earnGuideStore.setClosesOnFinish(true);
    if (isPreview) {
      earnGuideStore.setPreview(undefined);
    } else {
      earnGuideStore.save(scope, { hidden: true });
    }
    navigation.pop();
  }, [isPreview, navigation, scope]);
  const handleUseVault = useCallback(() => {
    if (!vaultOffer) {
      return;
    }
    isLocalRef.current = true;
    setPickedVaultKey(vaultOffer.key);
    if (isPreview) {
      earnGuideStore.setPreview(3);
    } else {
      earnGuideStore.save(scope, { vaultKey: vaultOffer.key });
    }
  }, [isPreview, scope, vaultOffer]);
  // A switch in the deposit form is the vault from then on, so step 4 shows
  // the one the deposit went to
  const handleDepositOfferChange = useCallback(
    (key: string) => {
      setPickedVaultKey(key);
      if (!isPreview && saved.vaultKey !== key) {
        earnGuideStore.save(scope, { vaultKey: key });
      }
    },
    [isPreview, saved.vaultKey, scope],
  );
  const handleDeposited = useCallback(
    (amount: string) => {
      isLocalRef.current = true;
      if (isPreview) {
        earnGuideStore.setPreview(4, amount);
      } else {
        earnGuideStore.save(scope, { depositedAt: Date.now(), amount });
      }
    },
    [isPreview, scope],
  );
  const handleFinish = useCallback(
    (toPosition: boolean) => {
      earnGuideStore.setClosesOnFinish(true);
      if (isPreview) {
        earnGuideStore.setPreview(undefined);
      } else {
        earnGuideStore.save(scope, { completed: true });
      }
      navigation.pop();
      if (toPosition && vaultOffer?.kind === 'protocol') {
        void EarnNavigation.pushToEarnProtocolDetails(navigation, {
          networkId,
          symbol: EARN_GUIDE_SYMBOL,
          provider: vaultOffer.item.provider.name,
          vault: vaultOffer.item.provider.vault,
          scrollToPortfolio: true,
        });
      }
    },
    [isPreview, navigation, networkId, scope, vaultOffer],
  );

  // The preview's deposit: the form's own button, which sends nothing and
  // finishes after a moment
  const typedRef = useRef('');
  const [isPreviewDepositing, setIsPreviewDepositing] = useState(false);
  useEffect(() => {
    if (!isPreviewDepositing) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setIsPreviewDepositing(false);
      handleDeposited(typedRef.current);
    }, PREVIEW_DEPOSIT_MS);
    return () => clearTimeout(timer);
  }, [handleDeposited, isPreviewDepositing]);
  const previewFooterAction = useMemo(
    () =>
      isPreview
        ? {
            text: intl.formatMessage({ id: ETranslations.earn_deposit }),
            onPress: () => setIsPreviewDepositing(true),
            loading: isPreviewDepositing,
          }
        : undefined,
    [intl, isPreview, isPreviewDepositing],
  );

  let body = null;
  let footer = null;
  if (shownStep === 1) {
    body = (
      <GasStep
        scope={scope}
        account={earnAccount?.account}
        address={address}
        network={network}
        hasWallet={hasWallet}
        hasGas={hasGas}
        isPreview={isPreview}
      />
    );
    // Without a wallet: connect one. With one, the address copies from its
    // row as on the receive page, and Buy is the other way to get ETH
    if (!hasWallet && !isPreview) {
      footer = (
        <Page.Footer
          onConfirmText={intl.formatMessage({
            id: ETranslations.global_connect_wallet,
          })}
          onConfirm={() => showAccountSelector()}
          confirmButtonProps={{ testID: 'earn-guide-connect' }}
        />
      );
    } else if (canBuy || isPreview) {
      footer = (
        <Page.Footer
          onConfirmText={intl.formatMessage({ id: ETranslations.global_buy })}
          onConfirm={() => (canBuy ? handleFiatCrypto(undefined) : undefined)}
          confirmButtonProps={{ testID: 'earn-guide-buy' }}
        />
      );
    }
  } else if (shownStep === 2) {
    body = (
      <VaultStep
        offers={offers}
        selected={vaultOffer}
        networkLogoURI={network?.logoURI}
        isLoaded={isOffersLoaded}
        onSelect={(offer) => setPickedVaultKey(offer.key)}
      />
    );
    footer = (
      <Page.Footer
        onConfirmText={copy.guideUseVault}
        onConfirm={handleUseVault}
        confirmButtonProps={{
          disabled: !vaultOffer,
          testID: 'earn-guide-use-vault',
        }}
      />
    );
  } else if (shownStep === 3) {
    body = (
      <YStack gap="$5">
        <YStack px="$5">
          <StepIntro
            title={copy.guideDepositTitle}
            body={copy.guideWithdrawNote}
          />
        </YStack>
        {/* The deposit modal's own form, Pay with and all, with its own
            inset; its button sits in this page's footer. The step names it,
            so its title line goes, History with it: a first deposit has
            none. A deposit moves to step 4 instead of closing */}
        {/* The form starts on the vault, so it waits for the list; till
            then its own loading shell */}
        {vaultOffer ? (
          <EarnOffersDeposit
            symbol={EARN_GUIDE_SYMBOL}
            networkId={networkId}
            offerKey={vaultOffer.key}
            onDeposited={handleDeposited}
            onAmountChange={(value) => {
              typedRef.current = value;
            }}
            onOfferChange={handleDepositOfferChange}
            onHeaderRightChange={noop}
            footerActionOverride={previewFooterAction}
          />
        ) : (
          <ManageSectionShell
            type={EManagePositionType.Staking}
            symbol={EARN_GUIDE_SYMBOL}
            isPendleProvider={false}
            hasProtocolSwitch
            isInModalContext
            depositOnly
            hasPayWith
            liftsHeaderControls
          />
        )}
      </YStack>
    );
  } else {
    body = (
      <DoneStep
        offer={vaultOffer}
        networkLogoURI={network?.logoURI}
        amount={isPreview ? previewAmount : saved.amount}
      />
    );
    footer = (
      <Page.Footer
        onConfirmText={copy.guideGoToPosition}
        onConfirm={() => handleFinish(true)}
        confirmButtonProps={{ testID: 'earn-guide-go-to-position' }}
        onCancelText={intl.formatMessage({ id: ETranslations.global_done })}
        // Taking the close argument keeps the footer from closing as well:
        // the finish closes
        onCancel={(_close) => handleFinish(false)}
        cancelButtonProps={{ testID: 'earn-guide-done' }}
      />
    );
  }

  return (
    <Page>
      <EarnGuideHeader
        shownStep={shownStep}
        onPickStep={setPicked}
        onHide={handleHide}
        onClose={handleClose}
      />
      <ScrollView flex={1}>
        <YStack testID={`earn-guide-body-${shownStep}`} py="$5">
          {shownStep === 3 ? body : <YStack px="$5">{body}</YStack>}
        </YStack>
      </ScrollView>
      {footer}
    </Page>
  );
}

function EarnGuidePageWithProvider() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      {/* Buy reads the home's token list, as the receive selector does */}
      <HomeTokenListProviderMirror>
        <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
          <DiscoveryBrowserProviderMirror>
            <EarnGuidePage />
          </DiscoveryBrowserProviderMirror>
        </EarnProviderMirror>
      </HomeTokenListProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

export default EarnGuidePageWithProvider;
