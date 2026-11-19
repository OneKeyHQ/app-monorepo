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
import {
  EARN_FULL_WIDTH_BUTTONS,
  EARN_HALF_BUTTON,
  EarnFormFooter,
} from '../../../Staking/components/EarnFormFooter';
import {
  StakingAmountInput,
  useOnBlurAmountValue,
} from '../../../Staking/components/StakingAmountInput';
import { useEarnAccount } from '../../../Staking/hooks/useEarnAccount';
import { ManageSectionShell } from '../../../Staking/pages/ManagePosition/components/ManagePositionContent';
import { EManagePositionType } from '../../../Staking/pages/ManagePosition/hooks/useManagePage';
import { useEarnDesktopHomeCopy } from '../../components/desktopHome/earnDesktopHomeCopy';
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
import {
  EarnOfferSwitcher,
  EarnOffersDeposit,
} from '../EarnRouter/EarnOffersDeposit';
import { useEarnRouterOffers } from '../EarnRouter/EarnRouterOffer';

import type { IEarnDesktopHoldOffer } from '../../components/desktopHome/earnDesktopHome.utils';
import type { IEarnGuideStep } from '../../components/desktopHome/earnGuide.utils';

const noop = () => {};
// A step that finishes on its own (the ETH lands) keeps its check on screen
// this long before the next one shows
const DONE_BEAT_MS = 900;
const GAS_POLL_MS = 8000;
// Displayed as sample text only. The preview QR does not encode an address.
const PREVIEW_ADDRESS = '0x92bAA173828d55B2F1ed611352Aa0627AB825178';
const PREVIEW_BALANCE = '100';
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
  const earnCopy = useEarnDesktopHomeCopy();
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

  const shownAddress = isPreview ? PREVIEW_ADDRESS : address;
  return (
    <YStack gap="$5">
      <StepIntro
        title={earnCopy.guideGasTitle}
        body={earnCopy.guideGasBody(EARN_GUIDE_SUGGESTED_GAS)}
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
              value={isPreview ? 'OneKey Earn Guide Preview' : shownAddress}
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
              focusable={!isPreview}
              focusVisibleStyle={{
                outlineWidth: 2,
                outlineColor: '$focusRing',
                outlineOffset: 2,
                outlineStyle: 'solid',
              }}
              onPress={isPreview ? undefined : () => copyText(shownAddress)}
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
            {hasGas ? earnCopy.guideGasReceived : earnCopy.guideGasWaiting}
          </SizableText>
        </XStack>
      ) : (
        <SizableText size="$bodyLg">{earnCopy.guideConnect}</SizableText>
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
  const earnCopy = useEarnDesktopHomeCopy();
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
      <YStack role="radiogroup" aria-label={earnCopy.guideVaultTitle} gap="$2">
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
      <StepIntro
        title={earnCopy.guideVaultTitle}
        body={earnCopy.guideVaultBody}
      />
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
  const earnCopy = useEarnDesktopHomeCopy();
  const intl = useIntl();
  const shownAmount = new BigNumber(amount ?? '');
  return (
    <YStack gap="$5">
      <StepIntro
        title={earnCopy.guideDoneTitle}
        body={earnCopy.guideDoneBody}
      />
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

function PreviewDepositStep({
  offers,
  selected,
  tokenLogoURI,
  networkLogoURI,
  onSelect,
  onComplete,
}: {
  offers: IEarnDesktopHoldOffer[];
  selected?: IEarnDesktopHoldOffer;
  tokenLogoURI?: string;
  networkLogoURI?: string;
  onSelect: (offer: IEarnDesktopHoldOffer) => void;
  onComplete: (amount: string) => void;
}) {
  const intl = useIntl();
  const copy = useEarnDesktopHomeCopy();
  const [amount, setAmount] = useState('');
  const handleBlur = useOnBlurAmountValue(amount, setAmount);
  const [isOpen, setIsOpen] = useState(false);
  const [submittedAmount, setSubmittedAmount] = useState<string>();
  const value = new BigNumber(amount);
  const canSubmit =
    Boolean(selected) && value.gt(0) && value.lte(PREVIEW_BALANCE);
  useEffect(() => {
    if (!submittedAmount) return undefined;
    const timer = setTimeout(
      () => onComplete(submittedAmount),
      PREVIEW_DEPOSIT_MS,
    );
    return () => clearTimeout(timer);
  }, [onComplete, submittedAmount]);

  return (
    <YStack px="$5" gap="$3">
      <StakingAmountInput
        title={copy.payWith}
        value={amount}
        onChange={setAmount}
        onBlur={handleBlur}
        disabled={Boolean(submittedAmount)}
        inputProps={{
          autoFocus: true,
          inputMode: 'decimal',
          testID: 'earn-guide-preview-amount',
        }}
        tokenSelectorTriggerProps={{
          selectedTokenImageUri: tokenLogoURI,
          selectedTokenSymbol: EARN_GUIDE_SYMBOL,
          disabled: true,
        }}
        balanceProps={{
          value: PREVIEW_BALANCE,
          tokenSymbol: EARN_GUIDE_SYMBOL,
          onPress: () => setAmount(PREVIEW_BALANCE),
        }}
        onSelectPercentageStage={(percent) =>
          setAmount(
            new BigNumber(PREVIEW_BALANCE).times(percent).div(100).toFixed(),
          )
        }
      />
      {selected ? (
        <EarnOfferSwitcher
          offers={offers}
          selected={selected}
          networkLogoURI={networkLogoURI}
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          onSelect={(offer) => {
            onSelect(offer);
            setIsOpen(false);
          }}
        />
      ) : null}
      <EarnFormFooter
        isInModalContext
        confirmText={intl.formatMessage({ id: ETranslations.earn_deposit })}
        confirmButtonProps={{
          onPress: () => {
            if (canSubmit && !submittedAmount) {
              setSubmittedAmount(value.toFixed());
            }
          },
          loading: Boolean(submittedAmount),
          disabled: !canSubmit || Boolean(submittedAmount),
          testID: 'earn-guide-preview-deposit',
        }}
      />
    </YStack>
  );
}

function EarnGuidePage() {
  const earnCopy = useEarnDesktopHomeCopy();
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
  const [previewVaultKey, setPreviewVaultKey] = useState<string>();
  useEffect(() => {
    if (!isPreview) setPreviewVaultKey(undefined);
  }, [isPreview]);
  const pickVault = useCallback(
    (offer: IEarnDesktopHoldOffer) => {
      if (isPreview) setPreviewVaultKey(offer.key);
      else setPickedVaultKey(offer.key);
    },
    [isPreview],
  );
  const vaultKey = isPreview
    ? previewVaultKey
    : (pickedVaultKey ?? saved.vaultKey);
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
    pickVault(vaultOffer);
    if (!isDeposited) {
      setPressedTo(current === 2 ? 3 : undefined);
      if (!isPreview) {
        earnGuideStore.save(scope, { vaultKey: vaultOffer.key });
      } else if (current === 2) {
        earnGuideStore.setPreview(3);
      }
    }
    setPicked(current < 3 ? undefined : 3);
  }, [current, isDeposited, isPreview, pickVault, scope, vaultOffer]);
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
      earnGuideStore.save(scope, {
        depositedAt: Date.now(),
        amount,
        ...(vaultOffer ? { vaultKey: vaultOffer.key } : {}),
      });
    },
    [current, scope, vaultOffer],
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

  const handlePreviewDeposited = useCallback((amount: string) => {
    if (earnGuideStore.getSnapshot().previewStep !== 3) return;
    setPressedTo(4);
    setPicked(undefined);
    earnGuideStore.setPreview(4, amount);
  }, []);

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
          buttonContainerProps={EARN_FULL_WIDTH_BUTTONS}
          confirmButtonProps={{
            ...EARN_HALF_BUTTON,
            testID: 'earn-guide-connect',
          }}
        />
      );
    } else if (canBuy || isPreview) {
      footer = (
        <Page.Footer
          key="buy"
          onConfirmText={intl.formatMessage({ id: ETranslations.global_buy })}
          onConfirm={() => {
            const previewStep = earnGuideStore.getSnapshot().previewStep;
            if (previewStep === 1) {
              setPressedTo(2);
              setPicked(undefined);
              earnGuideStore.setPreview(2);
            } else if (previewStep === undefined && !isPreview && canBuy) {
              void handleFiatCrypto(undefined);
            }
          }}
          buttonContainerProps={EARN_FULL_WIDTH_BUTTONS}
          confirmButtonProps={{ ...EARN_HALF_BUTTON, testID: 'earn-guide-buy' }}
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
        onSelect={pickVault}
      />
    );
    footer = (
      <Page.Footer
        key="vault"
        onConfirmText={earnCopy.guideUseVault}
        onConfirm={handleUseVault}
        buttonContainerProps={EARN_FULL_WIDTH_BUTTONS}
        confirmButtonProps={{
          ...EARN_HALF_BUTTON,
          disabled: !vaultOffer,
          testID: 'earn-guide-use-vault',
        }}
      />
    );
  } else if (shownStep === 3) {
    let depositForm = (
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
    );
    if (isPreview) {
      depositForm = (
        <PreviewDepositStep
          offers={offers}
          selected={vaultOffer}
          tokenLogoURI={tokenLogoURI}
          networkLogoURI={network?.logoURI}
          onSelect={pickVault}
          onComplete={handlePreviewDeposited}
        />
      );
    } else if (vaultOffer) {
      // The real form starts on the vault chosen in step 2 and moves the
      // guide to step 4 when the deposit goes out.
      depositForm = (
        <EarnOffersDeposit
          symbol={EARN_GUIDE_SYMBOL}
          networkId={networkId}
          logoURI={tokenLogoURI}
          offerKey={vaultOffer.key}
          offersLayout="switcher"
          onDeposited={handleDeposited}
          onOfferChange={handleDepositOfferChange}
          onHeaderRightChange={noop}
          payWithPickerHeight={EARN_GUIDE_MODAL_SIZE.height}
        />
      );
    }
    body = (
      <YStack gap="$5">
        <YStack px="$5">
          <StepIntro
            title={earnCopy.guideDepositTitle}
            body={earnCopy.guideWithdrawNote}
          />
        </YStack>
        {depositForm}
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
        onConfirmText={earnCopy.guideGoToPortfolio}
        onConfirm={() => handleFinish(true)}
        buttonContainerProps={EARN_FULL_WIDTH_BUTTONS}
        confirmButtonProps={{
          ...EARN_HALF_BUTTON,
          testID: 'earn-guide-go-to-position',
        }}
        onCancelText={intl.formatMessage({ id: ETranslations.global_done })}
        // Taking the close argument keeps the footer from closing as well:
        // the finish closes
        onCancel={(_close) => handleFinish(false)}
        cancelButtonProps={{ ...EARN_HALF_BUTTON, testID: 'earn-guide-done' }}
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
