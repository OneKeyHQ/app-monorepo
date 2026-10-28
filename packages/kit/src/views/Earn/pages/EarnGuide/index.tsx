import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import {
  Icon,
  Page,
  ScrollView,
  SizableText,
  Skeleton,
  Spinner,
  Stack,
  XStack,
  YStack,
  useClipboard,
  useMedia,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAccountSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger';
import { HighlightAddress } from '@onekeyhq/kit/src/components/HighlightAddress';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useEarnAtom } from '@onekeyhq/kit/src/states/jotai/contexts/earn';
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
  EARN_GUIDE_MODAL_SIZE,
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
  EARN_OFFER_OPTION_HEIGHT,
  EarnOfferOptionCard,
} from '../EarnRouter/EarnOfferOptionCard';
import { EarnOffersDeposit } from '../EarnRouter/EarnOffersDeposit';
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
// A step's body as the header moves to it: the step before can't stay to
// fade out (its form would keep the page's footer), so the new one fades in
const STEP_HIDDEN_STYLE = { opacity: 0 } as const;

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

// The receive page's code; a little smaller on a short window, so step 1
// fits the modal without scrolling at 768 tall
const QR_SIZE = { regular: 176, short: 144 };
const QR_CELL_PY = { regular: 27, short: 20 };

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
  const { short: isShort } = useMedia();
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
          <ReceiveCardCell
            ai="center"
            jc="center"
            py={isShort ? QR_CELL_PY.short : QR_CELL_PY.regular}
            px="$4"
          >
            <ReceiveQRCode
              value={shownAddress}
              size={isShort ? QR_SIZE.short : QR_SIZE.regular}
            />
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

// A vault as the guide names it: its own name first, the protocol under it
// (a market or a fixed rate keeps the protocol first), rate and TVL at the
// end. Step 2 lists them as choices, as the Swap page lists its routes
function GuideVaultCard({
  offer,
  networkLogoURI,
  isSelected = false,
  onSelect,
}: {
  offer: IEarnDesktopHoldOffer;
  networkLogoURI?: string;
  isSelected?: boolean;
  // A choice in step 2; without it the card only names the vault
  onSelect?: (offer: IEarnDesktopHoldOffer) => void;
}) {
  return (
    <EarnOfferOptionCard
      testID={`earn-guide-vault-${offer.key}`}
      offer={offer}
      networkLogoURI={networkLogoURI}
      isSelected={isSelected}
      onSelect={onSelect}
      vaultFirst
    />
  );
}

const VAULT_OPTION_HEIGHT = EARN_OFFER_OPTION_HEIGHT;

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
  // The PO's example first, the rest as the list ranks them
  const ordered = useMemo(
    () => [
      ...offers.filter(isGuideVaultOffer),
      ...offers.filter((offer) => !isGuideVaultOffer(offer)),
    ],
    [offers],
  );
  let list = null;
  if (ordered.length) {
    list = (
      <YStack role="radiogroup" aria-label={copy.guideVaultTitle} gap="$2">
        {ordered.map((offer) => (
          <GuideVaultCard
            key={offer.key}
            offer={offer}
            isSelected={offer.key === selected?.key}
            networkLogoURI={networkLogoURI}
            onSelect={onSelect}
          />
        ))}
      </YStack>
    );
  } else if (!isLoaded) {
    list = (
      <YStack gap="$2">
        <Skeleton h={VAULT_OPTION_HEIGHT} w="100%" borderRadius="$3" />
        <Skeleton h={VAULT_OPTION_HEIGHT} w="100%" borderRadius="$3" />
      </YStack>
    );
  }
  return (
    <YStack gap="$5">
      <StepIntro title={copy.guideVaultTitle} body={copy.guideVaultBody} />
      {list}
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
          <GuideVaultCard offer={offer} networkLogoURI={networkLogoURI} />
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
              <NumberSizeableTextWrapper
                size="$bodyMdMedium"
                formatter="balance"
                formatterOptions={{ tokenSymbol: EARN_GUIDE_SYMBOL }}
              >
                {shownAmount.toFixed()}
              </NumberSizeableTextWrapper>
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

  // Up and down for the card's ghost and the preview key. On wide windows
  // the home draws the way out first (the content goes, the guide goes back
  // into the card): the removal waits for it, then goes on as it was asked
  const reactNavigation = useNavigation();
  const isLeavingRef = useRef(false);
  const shownStepRef = useRef<IEarnGuideStep>(state.current);
  useEffect(() => {
    earnGuideStore.setModalOpen(true);
    const unsubscribe = reactNavigation.addListener('beforeRemove', (event) => {
      if (!isLeavingRef.current) {
        const leave = () => {
          isLeavingRef.current = true;
          reactNavigation.dispatch(event.data.action);
        };
        if (earnGuideStore.drawClose(leave, shownStepRef.current)) {
          event.preventDefault();
          return;
        }
      }
      earnGuideStore.setModalOpen(false);
    });
    return () => {
      unsubscribe();
      earnGuideStore.setModalOpen(false);
    };
  }, [reactNavigation]);

  // The guide ends under it when it stops applying to the account: the
  // preview turned off on a watched account, a position made elsewhere. Not
  // while the home reloads (a wallet just connected in step 1), nor once the
  // modal is on its way out (Hide guide, Done)
  const isLoading = Boolean(live?.isLoading);
  useEffect(() => {
    if (
      !guide.isShown &&
      !isLoading &&
      earnGuideStore.getSnapshot().isModalOpen
    ) {
      earnGuideStore.setClosesOnFinish(true);
      navigation.pop();
    }
  }, [guide.isShown, isLoading, navigation]);

  // The vault: the one picked in step 2, else the PO's example, else the
  // best rate on Base
  const { offers, isLoaded: isOffersLoaded } = useEarnRouterOffers({
    symbol: EARN_GUIDE_SYMBOL,
    networkId,
  });
  // The form names its token from the wallet's; with none (the preview) it
  // takes this one, the logo the Earn list shows
  const [{ availableAssetsByType }] = useEarnAtom();
  const tokenLogoURI = useMemo(() => {
    const asset = Object.values(availableAssetsByType ?? {})
      .flat()
      .find(
        (item) =>
          item.symbol.toUpperCase() === EARN_GUIDE_SYMBOL && item.logoURI,
      );
    if (asset) {
      return asset.logoURI;
    }
    const lending = offers.find((offer) => offer.kind === 'lending');
    return lending?.kind === 'lending' ? lending.offer.logoURI : undefined;
  }, [availableAssetsByType, offers]);
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
  // ETH landing) keeps its check a moment first. Settled in the render that
  // sees the change, so no frame shows the next step (or its button) early
  const { current } = state;
  const isDeposited = state.done[2];
  const [picked, setPicked] = useState<IEarnGuideStep>();
  const [pinned, setPinned] = useState<IEarnGuideStep>();
  // The step a press moves the guide on to, set by that press
  const [pressedTo, setPressedTo] = useState<IEarnGuideStep>();
  const [seenCurrent, setSeenCurrent] = useState(current);
  // This render goes on with the values the change sets, as the render React
  // runs again at once will have them
  let settledPinned = pinned;
  let settledPicked = picked;
  if (seenCurrent !== current) {
    settledPinned =
      pressedTo === current || current < seenCurrent ? undefined : seenCurrent;
    settledPicked = undefined;
    setSeenCurrent(current);
    setPicked(undefined);
    setPressedTo(undefined);
    setPinned(settledPinned);
  }
  useEffect(() => {
    if (pinned === undefined) {
      return undefined;
    }
    const timer = setTimeout(() => setPinned(undefined), DONE_BEAT_MS);
    return () => clearTimeout(timer);
  }, [pinned]);
  const shownStep = settledPinned ?? settledPicked ?? current;
  shownStepRef.current = shownStep;
  // Every step the guide moves to fades in; the one it opens on comes with
  // the modal. Only a body mounting takes the fade: a step's own key
  const [firstShownStep] = useState(shownStep);
  const [hasMoved, setHasMoved] = useState(false);
  if (!hasMoved && shownStep !== firstShownStep) {
    setHasMoved(true);
  }
  const reduceMotion = useReducedMotion();
  const hasGas = state.done[0];

  const handleClose = useCallback(() => {
    navigation.pop();
  }, [navigation]);
  // On to the deposit, from step 2 or from a visit back to it (still at 1
  // without the ETH). Until a deposit the pick is the guide's vault; after
  // one it is only the next deposit's
  const handleUseVault = useCallback(() => {
    if (!vaultOffer) {
      return;
    }
    setPickedVaultKey(vaultOffer.key);
    if (!isDeposited) {
      setPressedTo(current === 2 ? 3 : undefined);
      if (!isPreview) {
        earnGuideStore.save(scope, { vaultKey: vaultOffer.key });
      } else if (current === 2) {
        earnGuideStore.setPreview(3);
      }
    }
    setPicked(current < 3 ? undefined : 3);
  }, [current, isDeposited, isPreview, scope, vaultOffer]);
  // A switch in the deposit form is the vault from then on, as a pick is
  const handleDepositOfferChange = useCallback(
    (key: string) => {
      setPickedVaultKey(key);
      if (!isPreview && !isDeposited && saved.vaultKey !== key) {
        earnGuideStore.save(scope, { vaultKey: key });
      }
    },
    [isDeposited, isPreview, saved.vaultKey, scope],
  );
  // Step 4 shows what went in and where, also after a deposit from a visit
  // back to step 3
  const handleDeposited = useCallback(
    (amount: string) => {
      setPressedTo(current !== 4 ? 4 : undefined);
      setPicked(undefined);
      if (isPreview) {
        earnGuideStore.setPreview(4, amount);
      } else {
        earnGuideStore.save(scope, {
          depositedAt: Date.now(),
          amount,
          ...(vaultOffer ? { vaultKey: vaultOffer.key } : {}),
        });
      }
    },
    [current, isPreview, scope, vaultOffer],
  );
  // The vault the deposit went to, whatever was picked since
  const depositOffer = useMemo(
    () =>
      (!isPreview && offers.find((offer) => offer.key === saved.vaultKey)) ||
      vaultOffer,
    [isPreview, offers, saved.vaultKey, vaultOffer],
  );
  const handleFinish = useCallback(
    (toPosition: boolean) => {
      earnGuideStore.setClosesOnFinish(true);
      // Once the home has drawn the way out: the guide ends (the card gives
      // way to the hero), and the positions page comes, as Net Worth opens
      // it, where the deposit is a position with its Redeem. Ended before,
      // the modal would show the guide's first steps as it goes
      const leave = () => {
        isLeavingRef.current = true;
        navigation.pop();
        if (isPreview) {
          earnGuideStore.setPreview(undefined);
        } else {
          earnGuideStore.save(scope, { completed: true });
        }
        if (toPosition) {
          EarnNavigation.pushToEarnPositions(navigation);
        }
      };
      if (!earnGuideStore.drawClose(leave, shownStepRef.current, true)) {
        leave();
      }
    },
    [isPreview, navigation, scope],
  );

  // The preview's deposit: the form's own button, label and checks, whose
  // press sends nothing and finishes after a moment
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
            isPressOnly: true,
          }
        : undefined,
    [intl, isPreview, isPreviewDepositing],
  );

  // Each footer has its own key: a new one sets the page's footer as it
  // renders, with its step's body, where a changed one would set it a frame
  // later
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
          key="connect"
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
          key="buy"
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
        key="vault"
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
            logoURI={tokenLogoURI}
            offerKey={vaultOffer.key}
            // The vault was chosen in step 2: the others fold under it
            offersLayout="switcher"
            onDeposited={handleDeposited}
            onAmountChange={(value) => {
              typedRef.current = value;
            }}
            onOfferChange={handleDepositOfferChange}
            onHeaderRightChange={noop}
            footerActionOverride={previewFooterAction}
            payWithPickerHeight={EARN_GUIDE_MODAL_SIZE.height}
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
    // The form's button comes with the form. Till then the footer is empty,
    // not the last step's button: the one before goes as it renders. Placed
    // before the body, the form's own footer, rendered after it, wins
    footer = <Page.Footer key="deposit" />;
  } else {
    body = (
      <DoneStep
        offer={depositOffer}
        networkLogoURI={network?.logoURI}
        amount={isPreview ? previewAmount : saved.amount}
      />
    );
    footer = (
      <Page.Footer
        key="done"
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
        onClose={handleClose}
      />
      {footer}
      <ScrollView flex={1}>
        <YStack
          key={shownStep}
          testID={`earn-guide-body-${shownStep}`}
          py="$5"
          // Always there from its first render: the animation driver adds
          // hooks for it, and a view that gains them later breaks the page
          transition={reduceMotion ? undefined : 'quick'}
          animateOnly={ANIMATE_ONLY_OPACITY}
          enterStyle={hasMoved && !reduceMotion ? STEP_HIDDEN_STYLE : undefined}
        >
          {shownStep === 3 ? body : <YStack px="$5">{body}</YStack>}
        </YStack>
      </ScrollView>
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
