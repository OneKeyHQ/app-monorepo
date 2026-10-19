import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { FormattedMessage, useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { getColors } from 'react-native-image-colors';
import { useDebouncedCallback, useThrottledCallback } from 'use-debounce';

import {
  Button,
  Dialog,
  Empty,
  Icon,
  Image,
  Page,
  SegmentControl,
  SizableText,
  Skeleton,
  Stack,
  Toast,
  XStack,
  YStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import {
  EHardwareUiStateAction,
  EThirdPartyHardwareUiAction,
  useHardwareUiStateAtom,
  useThirdPartyHardwareUiStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
  IVaultSettings,
} from '@onekeyhq/kit-bg/src/vaults/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/config/vendorProfile';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IAggregateTokenSelectContext,
  IModalReceiveParamList,
  IReceiveNetworkSelection,
} from '@onekeyhq/shared/src/routes';
import {
  EModalReceiveRoutes,
  EModalRoutes,
  EModalSettingRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debug/debugUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { getReceiveArrivalTimeText } from '@onekeyhq/shared/src/utils/receiveArrivalTimeUtils';
import { getReceiveNetworkDisplayName } from '@onekeyhq/shared/src/utils/receiveNetworkStandardUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { mergeAggregateTokenMembers } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import { EConfirmOnDeviceType } from '@onekeyhq/shared/types/device';
import type { IAccountToken, IToken } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import AddressTypeSelector from '../../../components/AddressTypeSelector/AddressTypeSelector';
import { HighlightAddress } from '../../../components/HighlightAddress';
import { FormatHyperlinkText } from '../../../components/HyperlinkText';
import {
  NetworkAvatar,
  NetworkAvatarBase,
} from '../../../components/NetworkAvatar';
import { useAccountData } from '../../../hooks/useAccountData';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useCopyAddressWithDeriveType } from '../../../hooks/useCopyAccountAddress';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useWalletBanner } from '../../../hooks/useWalletBanner';
import { ReceiveCard, ReceiveCardCell } from '../components/ReceiveCard';
import { ReceiveQRCode } from '../components/ReceiveQRCode';
import {
  ShareImageGenerator,
  showReceiveShareDialog,
} from '../components/ReceiveShare';
import { ReceiveTitle } from '../components/ReceiveTitle';
import { ReceiveTestIDs } from '../testIDs';
import { EAddressState } from '../types';
import { getManualAddressVerificationPath } from '../utils/manualVerificationPathUtils';
import { resolveReceiveNetworkSwitchable } from '../utils/receiveNetworkSwitchUtils';
import {
  buildReceiveTitleLogo,
  resolveReceiveTitleIconURI,
} from '../utils/receiveTitleUtils';

import type {
  IReceiveShareData,
  IReceiveShareImageGeneratorRef,
} from '../components/ReceiveShare';
import type { RouteProp } from '@react-navigation/core';

function ReceiveToken() {
  useDebugComponentRemountLog({
    name: 'ReceiveToken9971',
  });
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<IModalReceiveParamList, EModalReceiveRoutes.ReceiveToken>
    >();

  const {
    networkId: routeNetworkId,
    accountId: routeAccountId,
    indexedAccountId: routeIndexedAccountId,
    walletId,
    token: routeToken,
    onDeriveTypeChange,
    disableSelector,
    btcUsedAddress,
    btcUsedAddressPath,
    exchangeSource,
    localWalletAddressForm,
    switchEntry,
    source: routeSource,
    isAllNetworksMode,
    aggregateToken: routeAggregateToken,
    aggregateSubTokenList: routeAggregateSubTokenList,
    allAggregateTokenList: routeAllAggregateTokenList,
    showDoneButton,
  } = route.params;

  // The route only seeds the page. Everything the QR code, the hardware
  // verification and the share image derive from lives in page state so an
  // in-page network switch (5.5 in the plan) replaces it atomically instead
  // of leaving a frame with the new network name over the old address.
  const [currentNetworkId, setCurrentNetworkId] = useState(routeNetworkId);
  const [currentAccountId, setCurrentAccountId] = useState(routeAccountId);
  const [currentToken, setCurrentToken] = useState<IToken | undefined>(
    routeToken,
  );
  const [currentNetwork, setCurrentNetwork] = useState<
    IServerNetwork | undefined
  >();
  const [currentVaultSettings, setCurrentVaultSettings] = useState<
    IVaultSettings | undefined
  >();
  // Set while a switch is resolving its account; the card keeps its header
  // (the network name stays tappable) and shows skeletons instead of any
  // address of the previous network.
  const [isSwitchPending, setIsSwitchPending] = useState(false);
  // Counts committed switches: every async writer compares against it before
  // landing, so a slow lookup from before a switch can never win. A switch
  // that fails leaves it alone, and with it whatever is still resolving for
  // the network on screen.
  const switchSeqRef = useRef(0);
  // Counts started switches: of two that overlap, only the newest may commit.
  const switchAttemptRef = useRef(0);
  // The network and account the page is committed to, written in the same
  // step as the sequence above. An account lookup also compares the target
  // it was started for against this before landing: between a commit and the
  // next render a stale closure can still start a lookup for the previous
  // network, and that one already carries the new sequence.
  const committedTargetRef = useRef({
    networkId: routeNetworkId,
    accountId: routeAccountId,
  });
  // True while a switch looks up its target. The page still shows the
  // previous network then, verification included, and a verification started
  // against it would settle after the switch.
  const isSwitchResolvingRef = useRef(false);
  // The account of the row a switch to a multi-address-type network was
  // picked from. The page resolves the default address type there; when the
  // wallet has none of that type, this is the address the user chose.
  const switchSelectedAccountIdRef = useRef<string | undefined>(undefined);

  const networkId = currentNetworkId;
  const accountId = currentAccountId;
  // The indexed account is the wallet-level scope and never changes with
  // the network.
  const indexedAccountId = routeIndexedAccountId;
  const token = currentToken;

  const {
    account: fetchedAccount,
    network: fetchedNetwork,
    wallet,
    vaultSettings: fetchedVaultSettings,
    deriveType: fetchedDeriveType,
    deriveInfo: fetchedDeriveInfo,
  } = useAccountData({
    accountId,
    networkId,
    walletId,
    // Clear the previous network's data the moment the ids change, so no
    // frame mixes the new network with the old account.
    options: { undefinedResultIfReRun: true },
  });

  // Belt and braces for the switch: only data for the current ids reaches
  // the page (a run cannot start while the selection page has focus).
  const isFetchedForCurrent =
    !!fetchedNetwork &&
    fetchedNetwork.id === networkId &&
    (!accountId || fetchedAccount?.id === accountId);
  const network =
    currentNetwork ?? (isFetchedForCurrent ? fetchedNetwork : undefined);
  const vaultSettings =
    currentVaultSettings ??
    (isFetchedForCurrent ? fetchedVaultSettings : undefined);

  // Multi-chain members behind the network switch. Carried along by the
  // selecting page when it had them; otherwise looked up from the synced
  // wallet config by network + contract address (token details member tab,
  // single-network mode).
  const [aggregateGroup, setAggregateGroup] = useState<{
    aggregateToken?: IAccountToken;
    aggregateSubTokenList?: IAccountToken[];
    allAggregateTokenList?: IAccountToken[];
  }>(() => ({
    aggregateToken: routeAggregateToken,
    aggregateSubTokenList: routeAggregateSubTokenList,
    allAggregateTokenList: routeAllAggregateTokenList,
  }));
  const aggregateMembers = useMemo(
    () =>
      mergeAggregateTokenMembers({
        aggregateSubTokenList: aggregateGroup.aggregateSubTokenList,
        allAggregateTokenList: aggregateGroup.allAggregateTokenList,
      }),
    [
      aggregateGroup.aggregateSubTokenList,
      aggregateGroup.allAggregateTokenList,
    ],
  );
  // Global members come from the synced config unless the entry carried
  // them.
  const hasRouteGlobalMembers = !!routeAllAggregateTokenList?.length;
  useEffect(() => {
    if (switchEntry !== 'token' || exchangeSource || hasRouteGlobalMembers) {
      return;
    }
    let cancelled = false;
    void backgroundApiProxy.serviceToken
      .findAggregateGroupByNetworkAndAddress({
        networkId: routeNetworkId,
        address: routeToken?.address ?? '',
        isNative: routeToken?.isNative,
      })
      .then((group) => {
        if (cancelled || !group) return;
        setAggregateGroup((prev) => ({
          aggregateToken: prev.aggregateToken ?? group.aggregateToken,
          aggregateSubTokenList: prev.aggregateSubTokenList,
          allAggregateTokenList: group.members,
        }));
      })
      .catch(() => {
        // No group → no switch trigger; the page behaves as today.
      });
    return () => {
      cancelled = true;
    };
  }, [
    switchEntry,
    exchangeSource,
    hasRouteGlobalMembers,
    routeNetworkId,
    routeToken?.address,
    routeToken?.isNative,
  ]);

  // Server overrides for the arrival ETA and protocol-standard label.
  // Resolves to undefined on fetch failure so the bundled defaults apply.
  const { result: receiveArrivalConfig, isLoading: isArrivalConfigLoading } =
    usePromiseResult(
      () => backgroundApiProxy.serviceNetwork.getReceiveArrivalConfig(),
      [],
      { watchLoading: true },
    );

  const [currentDeriveType, setCurrentDeriveType] = useState<
    IAccountDeriveTypes | undefined
  >(fetchedDeriveType);

  const [currentDeriveInfo, setCurrentDeriveInfo] = useState<
    IAccountDeriveInfo | undefined
  >(fetchedDeriveInfo);

  const [currentAccount, setCurrentAccount] = useState<
    INetworkAccount | undefined
  >(isFetchedForCurrent ? fetchedAccount : undefined);

  const { handleBannerOnPress } = useWalletBanner({
    account: currentAccount,
    network,
    wallet,
  });

  const isBtcUsedAddressVerifyMode = btcUsedAddress && btcUsedAddressPath;

  // Local-wallet chains: one account exposes a public and a private receive
  // form; the segment control in the card header switches them and the
  // QR / copy / share all follow displayAddress. On-device address
  // verification must target the currently displayed form.
  const localWalletAddressForms = vaultSettings?.localWallet?.addressForms;
  const { result: localWalletAddresses } = usePromiseResult(async () => {
    if (!localWalletAddressForms || !currentAccount?.id || !network?.id) {
      return undefined;
    }
    return backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountAddresses(
      {
        networkId: network.id,
        accountId: currentAccount.id,
      },
    );
  }, [localWalletAddressForms, network?.id, currentAccount?.id]);
  const [requestedAddressForm, setReceiveAddressForm] = useState<
    'public' | 'private'
  >(localWalletAddressForm ?? 'public');
  const localWalletPrivateAddress = localWalletAddresses?.privateAddress;
  // A chain with only a private form (Monero) always receives privately, from
  // whichever entry the page was opened.
  const receiveAddressForm: 'public' | 'private' =
    localWalletAddressForms && !localWalletAddressForms.publicLabel
      ? 'private'
      : requestedAddressForm;
  // Paused or never enabled: nothing scans the private address, so it is not
  // handed out; the page points at where scanning is turned on instead.
  const isPrivateReceiveUnavailable =
    localWalletAddressForms &&
    receiveAddressForm === 'private' &&
    localWalletAddresses !== undefined &&
    !localWalletPrivateAddress;

  let displayAddress = currentAccount?.address ?? '';
  if (isBtcUsedAddressVerifyMode) {
    displayAddress = btcUsedAddress;
  } else if (localWalletAddressForms && receiveAddressForm === 'private') {
    displayAddress = localWalletPrivateAddress ?? '';
  }
  const verificationPath = isBtcUsedAddressVerifyMode
    ? btcUsedAddressPath
    : currentAccount?.addressDetail?.receiveAddressPath;
  const manualVerificationPath = getManualAddressVerificationPath({
    receiveAddressPath: verificationPath,
    accountPath: currentAccount?.path,
    isBtcNetwork: networkUtils.isBTCNetwork(networkId),
  });
  const hardwareVendor = wallet?.associatedDeviceInfo?.vendor;
  const { addressVerification } = getVendorProfile(hardwareVendor);
  // What the page shows right now. A verification settles for the address it
  // was started with, which the page may have left by then.
  const shownAddressRef = useRef({ networkId, address: displayAddress });
  shownAddressRef.current = { networkId, address: displayAddress };

  const { bottom } = useSafeAreaInsets();

  const [addressState, setAddressState] = useState<EAddressState>(
    EAddressState.Unverified,
  );
  const [showManualVerificationPath, setShowManualVerificationPath] =
    useState(false);

  const [networkLogoColor, setNetworkLogoColor] = useState<string | null>(null);

  const [hardwareUiState] = useHardwareUiStateAtom();
  const [thirdPartyHardwareUiState] = useThirdPartyHardwareUiStateAtom();

  const copyAddressWithDeriveType = useCopyAddressWithDeriveType();

  const { result: fetchedBanner } = usePromiseResult(async () => {
    const banners =
      await backgroundApiProxy.serviceWalletBanner.fetchWalletBanner({
        accountId,
      });
    return banners.find(
      (_banner) =>
        _banner.position === 'receive' && _banner.networkId === networkId,
    );
  }, [accountId, networkId]);
  // The request lags an in-page network switch: until it lands, the result
  // still belongs to the previous network and must neither show nor be
  // pressed under the new one.
  const banner =
    fetchedBanner?.networkId === networkId ? fetchedBanner : undefined;

  const isHardwareWallet =
    accountUtils.isQrWallet({
      walletId,
    }) ||
    accountUtils.isHwWallet({
      walletId,
    });

  const shouldShowAddress = useMemo(() => {
    if (!isHardwareWallet) {
      return true;
    }

    if (
      addressState === EAddressState.ForceShow ||
      addressState === EAddressState.Verified
    ) {
      return true;
    }

    if (
      addressState === EAddressState.Verifying &&
      ((addressVerification.confirmationEvent === 'buttonRequest' &&
        hardwareUiState?.action === EHardwareUiStateAction.REQUEST_BUTTON) ||
        (addressVerification.confirmationEvent === 'confirmOnDevice' &&
          thirdPartyHardwareUiState?.action ===
            EThirdPartyHardwareUiAction.confirmOnDevice))
    ) {
      return true;
    }

    return false;
  }, [
    addressState,
    addressVerification.confirmationEvent,
    hardwareUiState?.action,
    thirdPartyHardwareUiState,
    isHardwareWallet,
  ]);

  const shouldShowQRCode = useMemo(() => {
    if (!displayAddress) return false;
    if (!isHardwareWallet) {
      return true;
    }

    if (
      addressState === EAddressState.ForceShow ||
      addressState === EAddressState.Verified
    ) {
      return true;
    }

    return false;
  }, [addressState, isHardwareWallet, displayAddress]);

  useEffect(() => {
    const url = network?.logoURI;

    if (!url) return;

    getColors(url, {
      key: url,
    })
      .then((colors) => {
        if (colors.platform === 'android' || colors.platform === 'web') {
          setNetworkLogoColor(colors.vibrant);
        }
        if (colors.platform === 'ios') {
          setNetworkLogoColor(colors.primary);
        }
      })
      .catch((error) => {
        console.error('Failed to get colors from network logo:', error);
      });
  }, [network?.logoURI]);

  const handleCopyAddress = useCallback(() => {
    if (!displayAddress) return;
    if (vaultSettings?.mergeDeriveAssetsEnabled && currentDeriveInfo) {
      copyAddressWithDeriveType({
        address: displayAddress,
        deriveInfo: currentDeriveInfo,
        networkName: network?.name,
      });
    } else {
      copyAddressWithDeriveType({
        address: displayAddress,
        networkName: network?.name,
      });
    }
  }, [
    copyAddressWithDeriveType,
    currentDeriveInfo,
    displayAddress,
    network?.name,
    vaultSettings?.mergeDeriveAssetsEnabled,
  ]);

  // Auto-navigate to ExchangeOpenRedirect after HW address verification
  const hasNavigatedToRedirectRef = useRef(false);
  useEffect(() => {
    if (
      !exchangeSource ||
      !displayAddress ||
      !isHardwareWallet ||
      hasNavigatedToRedirectRef.current
    ) {
      return;
    }
    if (
      addressState !== EAddressState.Verified &&
      addressState !== EAddressState.ForceShow
    ) {
      return;
    }
    hasNavigatedToRedirectRef.current = true;
    navigation.push(EModalReceiveRoutes.ExchangeOpenRedirect, {
      exchangeSource,
      address: displayAddress,
    });
  }, [
    exchangeSource,
    displayAddress,
    isHardwareWallet,
    addressState,
    navigation,
  ]);

  const throttledSyncBTCFreshAddress = useThrottledCallback(
    (params: { networkId: string; accountId: string }) => {
      void backgroundApiProxy.serviceFreshAddress.syncBTCFreshAddressByAccountId(
        params,
      );
    },
    timerUtils.getTimeDurationMs({ seconds: 1 }),
    { leading: true, trailing: true },
  );

  useEffect(() => {
    if (networkUtils.isBTCNetwork(networkId) && currentAccount?.id) {
      throttledSyncBTCFreshAddress({
        networkId,
        accountId: currentAccount.id,
      });
    }
  }, [currentAccount?.id, networkId, throttledSyncBTCFreshAddress]);

  // A verify can be superseded before its promise settles: the hardware stage's
  // user-close fires the device cancel with `void` and announces
  // CloseHardwareUiStateDialogManually straight away, so the abandoned call
  // rejects well after the page has re-armed for a retry. Scope every
  // settlement to the attempt that started it, otherwise a stale one clears the
  // guard out from under the attempt now running.
  const verifyAttemptRef = useRef(0);
  const isVerifyingRef = useRef(false);

  // Every out-of-band reset invalidates the in-flight attempt.
  const resetVerifyState = useCallback(() => {
    verifyAttemptRef.current += 1;
    isVerifyingRef.current = false;
    setShowManualVerificationPath(false);
    setAddressState(EAddressState.Unverified);
  }, []);

  useEffect(() => {
    resetVerifyState();
  }, [displayAddress, verificationPath, resetVerifyState]);

  const handleVerifyOnDevicePress = useCallback(async () => {
    if (isVerifyingRef.current || isSwitchResolvingRef.current) return;
    if (!displayAddress) {
      setAddressState(EAddressState.Unverified);
      return;
    }
    if (addressVerification.mode === 'manual') {
      // Manual mode has no device round-trip to gate on, so the address is
      // only revealed once the user acknowledges they must compare it on the
      // device themselves.
      Dialog.confirm({
        icon: 'ErrorOutline',
        tone: 'warning',
        title: intl.formatMessage({
          id: ETranslations.global_receive_address_confirmation,
        }),
        description: intl.formatMessage({
          // The path block only renders when a path exists, so the copy must
          // not ask the user to compare one that is never shown.
          id: manualVerificationPath
            ? ETranslations.hardware_third_party_manual_verify__desc
            : ETranslations.hardware_third_party_manual_verify_address_only__desc,
        }),
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_i_got_it,
        }),
        onConfirm: () => {
          setShowManualVerificationPath(true);
          setAddressState(EAddressState.ForceShow);
        },
        confirmButtonProps: {
          variant: 'secondary',
        },
      });
      return;
    }
    if (!currentDeriveType) return;
    setShowManualVerificationPath(false);
    const attempt = verifyAttemptRef.current + 1;
    verifyAttemptRef.current = attempt;
    isVerifyingRef.current = true;
    setAddressState(EAddressState.Verifying);
    try {
      const addresses =
        await backgroundApiProxy.serviceAccount.verifyHWAccountAddresses({
          walletId,
          networkId,
          indexedAccountId: currentAccount?.indexedAccountId,
          deriveType: currentDeriveType,
          confirmOnDevice: EConfirmOnDeviceType.EveryItem,
          customReceiveAddressPath: verificationPath,
          expectedAddress: displayAddress,
          localWalletAddressForm: localWalletAddressForms
            ? receiveAddressForm
            : undefined,
        });

      if (verifyAttemptRef.current !== attempt) return;
      const isSameAddress = localWalletAddressForms
        ? addresses?.[0] === displayAddress
        : addresses?.[0]?.toLowerCase() === displayAddress.toLowerCase();

      defaultLogger.transaction.receive.showReceived({
        walletType: wallet?.type,
        isSuccess: isSameAddress,
        failedReason: isSameAddress
          ? ''
          : intl.formatMessage({
              id: ETranslations.feedback_address_mismatch,
            }),
      });

      if (!isSameAddress) {
        Dialog.confirm({
          icon: 'ErrorOutline',
          tone: 'destructive',
          title: intl.formatMessage({
            id: ETranslations.feedback_address_mismatch,
          }),
          description: intl.formatMessage({
            id: ETranslations.feedback_address_mismatch_desc,
          }),
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_contact_us,
          }),
          onConfirm: () => showIntercom(),
          confirmButtonProps: {
            variant: 'primary',
          },
        });
      }
      // The device confirmed the address this attempt started with. If the
      // page shows another network or address by now, that one is unverified.
      const isShownAddress =
        shownAddressRef.current.networkId === networkId &&
        shownAddressRef.current.address === displayAddress;
      if (verifyAttemptRef.current === attempt) {
        setAddressState(
          isSameAddress && isShownAddress
            ? EAddressState.Verified
            : EAddressState.Unverified,
        );
      }
    } catch (e: any) {
      if (verifyAttemptRef.current === attempt) {
        setAddressState(EAddressState.Unverified);
      }
      // verifyHWAccountAddresses handler error toast
      defaultLogger.transaction.receive.showReceived({
        walletType: wallet?.type,
        isSuccess: false,
        failedReason: (e as Error).message,
      });
      throw e;
    } finally {
      // A superseded attempt must not release the guard the live one holds.
      if (verifyAttemptRef.current === attempt) {
        isVerifyingRef.current = false;
      }
    }
  }, [
    currentAccount?.indexedAccountId,
    currentDeriveType,
    displayAddress,
    localWalletAddressForms,
    receiveAddressForm,
    intl,
    networkId,
    addressVerification.mode,
    manualVerificationPath,
    verificationPath,
    wallet?.type,
    walletId,
  ]);

  const isVerifying = addressState === EAddressState.Verifying;

  // Two surfaces start the same hardware call: the footer button and the QR
  // placeholder card. On native the device stage UI only covers the page once
  // the BLE transport is ready, seconds after the press, so the debounce
  // collapses a rapid double tap and isVerifying holds the rest of that window.
  const handleVerifyOnDevicePressDebounced = useDebouncedCallback(
    handleVerifyOnDevicePress,
    500,
    { leading: true, trailing: false },
  );

  // The stage close event is global: closing a device stage opened by the
  // network selection page (address creation) must not reset this page's
  // verification, so only a verification this page started reacts.
  useEffect(() => {
    const handler = () => {
      if (isVerifyingRef.current) {
        resetVerifyState();
      }
    };
    appEventBus.on(
      EAppEventBusNames.CloseHardwareUiStateDialogManually,
      handler,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.CloseHardwareUiStateDialogManually,
        handler,
      );
    };
  }, [resetVerifyState]);

  const fetchAccount = useCallback(async () => {
    if (!accountId && networkId && indexedAccountId) {
      const seq = switchSeqRef.current;
      // By the time a result lands the page may have moved to another
      // network, or to another account of this one.
      const isSuperseded = () =>
        seq !== switchSeqRef.current ||
        committedTargetRef.current.networkId !== networkId ||
        committedTargetRef.current.accountId !== accountId;
      let resolved = false;
      try {
        const defaultDeriveType =
          await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId,
          });

        const { accounts } =
          await backgroundApiProxy.serviceAccount.getAccountsByIndexedAccounts({
            indexedAccountIds: [indexedAccountId],
            networkId,
            deriveType: defaultDeriveType,
          });

        if (accounts?.[0]) {
          const deriveResp =
            await backgroundApiProxy.serviceNetwork.getDeriveTypeByTemplate({
              networkId,
              template: accounts[0].template,
              accountId: accounts[0].id,
            });
          if (isSuperseded()) return;
          setCurrentDeriveInfo(deriveResp.deriveInfo);
          setCurrentDeriveType(deriveResp.deriveType);
          setCurrentAccount(accounts[0]);
          setIsSwitchPending(false);
          resolved = true;
        }
      } catch (_e) {
        // No account of the default address type (the lookup throws for a
        // missing record): handled below.
      }
      if (!resolved) {
        try {
          const { networkAccounts } =
            await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
              {
                networkId,
                indexedAccountId,
                excludeEmptyAccount: true,
              },
            );
          if (isSuperseded()) return;
          const selectedAccountId = switchSelectedAccountIdRef.current;
          const nonEmptyAccount =
            networkAccounts.find(
              (item) =>
                !!selectedAccountId && item.account?.id === selectedAccountId,
            ) ?? networkAccounts.find((item) => item.account);
          if (nonEmptyAccount) {
            setCurrentAccount(nonEmptyAccount.account);
            setCurrentDeriveType(nonEmptyAccount.deriveType);
            setCurrentDeriveInfo(nonEmptyAccount.deriveInfo);
            setIsSwitchPending(false);
            resolved = true;
          }
        } catch (error) {
          // On entry this surfaces the way it always has. After a switch it
          // is one more way of not resolving an account, reported below.
          if (seq === 0) {
            throw error;
          }
        }
      }
      // After a switch the placeholder stays (the header remains tappable
      // for a retry) and the user is told; the initial mount keeps today's
      // silent behavior.
      if (!resolved && seq > 0 && !isSuperseded()) {
        Toast.error({
          title: intl.formatMessage({ id: ETranslations.global_unknown_error }),
        });
      }
    }
  }, [accountId, indexedAccountId, intl, networkId]);

  useEffect(() => {
    void fetchAccount();
  }, [fetchAccount, currentDeriveType, onDeriveTypeChange]);

  const throttledRefreshOnEvent = useThrottledCallback(
    () => {
      void fetchAccount();
    },
    timerUtils.getTimeDurationMs({ seconds: 1 }),
    { leading: true, trailing: true },
  );

  useEffect(() => {
    if (!networkUtils.isBTCNetwork(networkId)) {
      return;
    }
    const handler = () => {
      throttledRefreshOnEvent();
    };
    appEventBus.on(EAppEventBusNames.BtcFreshAddressUpdated, handler);
    return () => {
      appEventBus.off(EAppEventBusNames.BtcFreshAddressUpdated, handler);
    };
  }, [networkId, throttledRefreshOnEvent]);

  useEffect(() => {
    if (!isHardwareWallet) {
      defaultLogger.transaction.receive.showReceived({
        walletType: wallet?.type,
        isSuccess: true,
        failedReason: '',
      });
    }
  }, [isHardwareWallet, wallet?.type]);

  // Network / vault settings are read straight from the fetch (or from the
  // switch hint); only the account and its derive info become page state,
  // since the address-type dropdown rewrites them.
  useEffect(() => {
    if (!isFetchedForCurrent) {
      return;
    }
    if (fetchedDeriveInfo) {
      setCurrentDeriveInfo(fetchedDeriveInfo);
    }
    if (fetchedDeriveType) {
      setCurrentDeriveType(fetchedDeriveType);
    }
    if (fetchedAccount) {
      setCurrentAccount(fetchedAccount);
      setIsSwitchPending(false);
    }
  }, [
    isFetchedForCurrent,
    fetchedAccount,
    fetchedDeriveInfo,
    fetchedDeriveType,
  ]);

  useEffect(() => {
    if (btcUsedAddress || btcUsedAddressPath) {
      resetVerifyState();
    }
  }, [btcUsedAddress, btcUsedAddressPath, resetVerifyState]);

  // One exposure per resolved network: on entry and after each switch
  // (A → B → A reports twice). Keyed by switch sequence so a re-render or a
  // derive-type change on the same network does not report again.
  const reportedPageShownKeyRef = useRef('');
  useEffect(() => {
    if (!currentAccount || !network) {
      return;
    }
    const key = `${switchSeqRef.current}:${network.id}`;
    if (reportedPageShownKeyRef.current === key) {
      return;
    }
    reportedPageShownKeyRef.current = key;
    defaultLogger.transaction.receive.receivePageShown({
      networkId: network.id,
      source: routeSource ?? 'unknown',
      switched: switchSeqRef.current > 0,
      walletType: wallet?.type,
      isAllNetworksMode,
    });
  }, [currentAccount, isAllNetworksMode, network, routeSource, wallet?.type]);

  const renderAddressCell = useCallback(() => {
    if (!displayAddress) return null;

    return (
      <ReceiveCardCell>
        <XStack
          testID={ReceiveTestIDs.AddressText}
          px="$4"
          py="$3"
          gap="$3"
          alignItems="flex-start"
          borderRadius="$2.5"
          onPress={handleCopyAddress}
          userSelect="none"
          hoverStyle={{
            bg: '$bgHover',
          }}
          pressStyle={{
            bg: '$bgActive',
          }}
          focusable
          focusVisibleStyle={{
            outlineWidth: 2,
            outlineColor: '$focusRing',
            outlineOffset: 2,
            outlineStyle: 'solid',
          }}
        >
          <YStack flex={1} gap="$2">
            <XStack flexWrap="wrap">
              <HighlightAddress
                address={displayAddress}
                size="$bodyLg"
                fontFamily="$monoRegular"
              />
            </XStack>
            {showManualVerificationPath ? (
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.verify_on_device_confirm_address__desc,
                })}
              </SizableText>
            ) : null}
            {showManualVerificationPath && manualVerificationPath ? (
              <YStack testID={ReceiveTestIDs.DerivationPath} gap="$0.5">
                <SizableText size="$bodySm" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.global_derivation_path,
                  })}
                </SizableText>
                <SizableText
                  size="$bodySmMedium"
                  color="$text"
                  fontFamily="$monoRegular"
                >
                  {manualVerificationPath}
                </SizableText>
              </YStack>
            ) : null}
          </YStack>
          {platformEnv.isNative ? null : (
            <Stack
              testID={ReceiveTestIDs.CopyAddressButton}
              mt="$0.5"
              flexShrink={0}
            >
              <Icon name="Copy3Outline" size="$5" color="$iconSubdued" />
            </Stack>
          )}
        </XStack>
      </ReceiveCardCell>
    );
  }, [
    displayAddress,
    handleCopyAddress,
    intl,
    showManualVerificationPath,
    manualVerificationPath,
  ]);

  const arrivalTimeText = useMemo(() => {
    // Until the server override settles, render no ETA instead of the
    // bundled default — the default may differ a lot from the override and
    // would flash before being replaced. `isLoading` starts as undefined,
    // so gate on `!== false`. Failure resolves undefined and falls back to
    // the bundled defaults below.
    if (isArrivalConfigLoading !== false) {
      return undefined;
    }
    // The text is formatted via appLocale inside the util; depending on
    // intl.locale recomputes it when the app language changes.
    void intl.locale;
    return getReceiveArrivalTimeText({
      networkId,
      isTestnet: network?.isTestnet,
      isCustomNetwork: network?.isCustomNetwork,
      override: receiveArrivalConfig,
    });
  }, [
    isArrivalConfigLoading,
    intl.locale,
    networkId,
    network?.isTestnet,
    network?.isCustomNetwork,
    receiveArrivalConfig,
  ]);

  // After a switch the title keeps the group's public symbol (the member
  // rows may carry a chain-specific symbol); before that it stays whatever
  // the entry showed.
  const hasSwitched = switchSeqRef.current > 0;
  const titleSymbol =
    (hasSwitched ? aggregateGroup.aggregateToken?.commonSymbol : undefined) ??
    token?.symbol ??
    network?.symbol ??
    '';
  // Entered by network: the page is bound to no token and the network is
  // named right below the title, so the title says what the page holds.
  const pageTitleText = useMemo(
    () =>
      switchEntry === 'network'
        ? intl.formatMessage({ id: ETranslations.receive_address__title })
        : intl.formatMessage(
            { id: ETranslations.receive_token__title },
            { token: titleSymbol },
          ),
    [switchEntry, intl, titleSymbol],
  );
  // The token logo in the title: only for a token the page was opened with,
  // and taken from the same level as the symbol it sits next to.
  const isGroupSymbolShown =
    hasSwitched && Boolean(aggregateGroup.aggregateToken?.commonSymbol);
  const titleIconURI = resolveReceiveTitleIconURI({
    isNetworkEntry: switchEntry === 'network',
    tokenLogoURI: token?.logoURI,
    groupLogoURI: isGroupSymbolShown
      ? aggregateGroup.aggregateToken?.logoURI
      : undefined,
  });
  const titleLogo = useMemo(
    () =>
      buildReceiveTitleLogo({
        uri: titleIconURI,
        symbol: titleSymbol,
        formatTitle: (tokenText) =>
          intl.formatMessage(
            { id: ETranslations.receive_token__title },
            { token: tokenText },
          ),
      }),
    [titleIconURI, intl, titleSymbol],
  );

  // e.g. "Ethereum (ERC20)" — shown for native coins and tokens alike
  const networkDisplayName = useMemo(
    () =>
      getReceiveNetworkDisplayName({
        networkName: network?.name,
        networkId,
        isTestnet: network?.isTestnet,
        isCustomNetwork: network?.isCustomNetwork,
        override: { byNetworkId: receiveArrivalConfig?.standardByNetworkId },
      }),
    [
      network?.name,
      networkId,
      network?.isTestnet,
      network?.isCustomNetwork,
      receiveArrivalConfig?.standardByNetworkId,
    ],
  );

  const shareData = useMemo<IReceiveShareData | null>(() => {
    if (!network || !displayAddress) return null;
    return {
      title: pageTitleText,
      titleLogo,
      subtitle: intl.formatMessage(
        { id: ETranslations.receive_send_asset_warning_message },
        { network: networkDisplayName },
      ),
      networkName: networkDisplayName,
      address: displayAddress,
    };
  }, [
    network,
    displayAddress,
    pageTitleText,
    titleLogo,
    networkDisplayName,
    intl,
  ]);

  const canShowShareEntry = shouldShowQRCode && !!displayAddress && !!shareData;

  // pre-generate the share image before opening the dialog so the preview
  // shows instantly and the dialog doesn't jump while the image loads
  const shareGeneratorRef = useRef<IReceiveShareImageGeneratorRef | null>(null);
  const [isPreparingShare, setIsPreparingShare] = useState(false);

  const handleSharePress = useCallback(async () => {
    if (!shareData || isPreparingShare) return;
    setIsPreparingShare(true);
    let presetImage = '';
    try {
      presetImage = (await shareGeneratorRef.current?.generate()) ?? '';
    } finally {
      setIsPreparingShare(false);
    }
    // fall back to in-dialog generation if pre-generation failed
    showReceiveShareDialog(shareData, {
      presetImage: presetImage || undefined,
    });
  }, [shareData, isPreparingShare]);

  const handleDonePress = useCallback(() => {
    navigation.popStack();
  }, [navigation]);

  const renderHeaderRight = useCallback(() => {
    const shareButton =
      platformEnv.isNative || !canShowShareEntry ? null : (
        <Button
          testID={ReceiveTestIDs.ShareButton}
          variant="secondary"
          size="small"
          icon="ShareOutline"
          loading={isPreparingShare}
          onPress={handleSharePress}
        >
          {intl.formatMessage({ id: ETranslations.explore_share })}
        </Button>
      );
    // Deposit entries such as Swap's "Deposit to Trade" ask for a one-tap way
    // back to the caller: Done closes the whole receive modal at once.
    const doneButton = showDoneButton ? (
      <Button
        testID={ReceiveTestIDs.DoneButton}
        variant="primary"
        size="small"
        onPress={handleDonePress}
      >
        {intl.formatMessage({ id: ETranslations.global_done })}
      </Button>
    ) : null;
    if (!shareButton && !doneButton) {
      return null;
    }
    return (
      <XStack alignItems="center" gap="$2">
        {shareButton}
        {doneButton}
      </XStack>
    );
  }, [
    canShowShareEntry,
    handleDonePress,
    handleSharePress,
    isPreparingShare,
    intl,
    showDoneButton,
  ]);

  // An imported, watch-only or external account only exists on the networks
  // it is compatible with and cannot get an address anywhere else, so
  // members on other networks are no target for a switch.
  const switchTargetCount = useMemo(() => {
    if (!accountUtils.isOthersWallet({ walletId })) {
      return aggregateMembers.length;
    }
    if (!currentAccount) {
      return 0;
    }
    return aggregateMembers.filter(
      (member) =>
        !!member.networkId &&
        accountUtils.isAccountCompatibleWithNetwork({
          account: currentAccount,
          networkId: member.networkId,
        }),
    ).length;
  }, [aggregateMembers, currentAccount, walletId]);

  const { isSwitchable: isNetworkSwitchable, isSwitchEnabled } =
    resolveReceiveNetworkSwitchable({
      switchEntry,
      exchangeSource,
      isBtcUsedAddressVerifyMode: !!isBtcUsedAddressVerifyMode,
      memberCount: switchTargetCount,
      isVerifying,
      isPreparingShare,
    });

  // 5.5 state machine: one sequence number per switch; clear every value
  // derived from the previous network in a single write, then resolve the
  // account for the new one (same rules as entering the page) and let only
  // the newest sequence land.
  const applyNetworkSwitch = useCallback(
    async ({
      networkId: targetNetworkId,
      accountId: targetAccountId,
      token: targetToken,
      network: targetNetworkHint,
      selectContext,
    }: {
      networkId: string;
      accountId?: string;
      token?: IToken;
      network?: IServerNetwork;
      selectContext?: IAggregateTokenSelectContext;
    }) => {
      if (!targetNetworkId) {
        return;
      }
      // Compared with the committed network, not this render's: a switch may
      // have landed since the picker was opened.
      const fromNetworkId = committedTargetRef.current.networkId;
      if (targetNetworkId === fromNetworkId) {
        // Picking the network on screen is the last word: a switch still
        // looking up its target is withdrawn.
        switchAttemptRef.current += 1;
        isSwitchResolvingRef.current = false;
        return;
      }
      // The selection page resolves addresses in its own scope; a row from
      // another wallet must never land on this page.
      if (
        targetAccountId &&
        accountUtils.getWalletIdFromAccountId({
          accountId: targetAccountId,
        }) !== walletId
      ) {
        return;
      }
      const attempt = switchAttemptRef.current + 1;
      switchAttemptRef.current = attempt;
      isSwitchResolvingRef.current = true;
      try {
        defaultLogger.transaction.receive.receiveSwitchNetwork({
          fromNetworkId,
          toNetworkId: targetNetworkId,
          source: routeSource ?? 'unknown',
          listType: switchEntry === 'network' ? 'all' : 'aggregate',
          walletType: wallet?.type,
          deviceType: wallet?.associatedDeviceInfo?.deviceType,
          createdAddress: !!selectContext?.createdAddress,
          isAllNetworksMode,
        });

        // Nothing is written before the target is known: when the lookup or
        // the checks below fail, the page keeps the network, address and
        // verification it has, and the user can pick again.
        const target = await Promise.all([
          backgroundApiProxy.serviceNetwork.getVaultSettings({
            networkId: targetNetworkId,
          }),
          targetNetworkHint
            ? Promise.resolve(targetNetworkHint)
            : backgroundApiProxy.serviceNetwork.getNetwork({
                networkId: targetNetworkId,
              }),
        ]).catch(() => undefined);
        if (attempt !== switchAttemptRef.current) {
          return;
        }
        if (!target) {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.global_unknown_error,
            }),
          });
          return;
        }
        const [settings, targetNetwork] = target;
        // A row of the network list shows one concrete address, and that is
        // the one the page resolves, address type included (as on entering
        // from that list). A token row stands for every address type of a
        // multi-address-type chain: there the page derives the default type
        // from the indexed account (same as entering with an empty
        // accountId). Other chains use the account the selected row carries.
        const keepsSelectedAccount =
          switchEntry === 'network' && !!targetAccountId;
        const useDerivePath =
          !keepsSelectedAccount &&
          !!settings.mergeDeriveAssetsEnabled &&
          !!indexedAccountId &&
          !accountUtils.isOthersWallet({ walletId });
        if (!useDerivePath && !targetAccountId) {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.global_unknown_error,
            }),
          });
          return;
        }

        // Committing the target clears the previous network's verification
        // in the same write: nothing started against it may settle into the
        // new one.
        resetVerifyState();
        setIsSwitchPending(true);
        setCurrentNetwork(targetNetwork);
        setCurrentVaultSettings(settings);
        setCurrentAccount(undefined);
        setCurrentDeriveType(undefined);
        setCurrentDeriveInfo(undefined);
        setNetworkLogoColor(null);
        setCurrentToken(targetToken);
        if (selectContext?.aggregateToken) {
          setAggregateGroup((prev) => ({
            aggregateToken: selectContext.aggregateToken ?? prev.aggregateToken,
            aggregateSubTokenList:
              selectContext.aggregateSubTokenList ?? prev.aggregateSubTokenList,
            allAggregateTokenList:
              selectContext.allAggregateTokenList ?? prev.allAggregateTokenList,
          }));
        }
        switchSelectedAccountIdRef.current = useDerivePath
          ? targetAccountId
          : undefined;
        const nextAccountId = useDerivePath ? '' : (targetAccountId ?? '');
        // From here on, lookups started for the previous target are stale.
        switchSeqRef.current += 1;
        committedTargetRef.current = {
          networkId: targetNetworkId,
          accountId: nextAccountId,
        };
        setCurrentNetworkId(targetNetworkId);
        setCurrentAccountId(nextAccountId);
      } finally {
        // A newer switch owns the guard from the moment it starts.
        if (attempt === switchAttemptRef.current) {
          isSwitchResolvingRef.current = false;
        }
      }
    },
    [
      switchEntry,
      indexedAccountId,
      intl,
      isAllNetworksMode,
      resetVerifyState,
      routeSource,
      wallet?.associatedDeviceInfo?.deviceType,
      wallet?.type,
      walletId,
    ],
  );

  // Token entry: a member row of the token's multi-chain group.
  const handleSwitchNetwork = useCallback(
    (member: IAccountToken, selectContext?: IAggregateTokenSelectContext) =>
      applyNetworkSwitch({
        networkId: member.networkId ?? '',
        accountId: member.accountId,
        token: member,
        network: selectContext?.network,
        selectContext,
      }),
    [applyNetworkSwitch],
  );

  // Network entry: any network of the wallet; the page shows its native coin.
  const handleSelectNetworkEntry = useCallback(
    ({
      network: selectedNetwork,
      accountId: selectedAccountId,
      createdAddress,
    }: IReceiveNetworkSelection) =>
      applyNetworkSwitch({
        networkId: selectedNetwork.id,
        accountId: selectedAccountId,
        token: undefined,
        network: selectedNetwork,
        selectContext: { createdAddress },
      }),
    [applyNetworkSwitch],
  );

  const handleOpenNetworkSelector = useCallback(() => {
    if (!isSwitchEnabled) {
      return;
    }
    const selectorAccountId = currentAccount?.id || accountId || routeAccountId;
    // The picker opens as its own modal stacked over this one (not a page
    // pushed into this stack); closing it after the pick lands back here.
    if (switchEntry === 'network') {
      navigation.pushModal(EModalRoutes.ReceiveModal, {
        screen: EModalReceiveRoutes.ReceiveSelectNetwork,
        params: {
          walletId,
          indexedAccountId,
          accountId: selectorAccountId,
          onSelect: handleSelectNetworkEntry,
        },
      });
      return;
    }
    if (!aggregateGroup.aggregateToken) {
      return;
    }
    navigation.pushModal(EModalRoutes.ReceiveModal, {
      screen: EModalReceiveRoutes.ReceiveSelectAggregateToken,
      params: {
        accountId: selectorAccountId,
        indexedAccountId,
        aggregateToken: aggregateGroup.aggregateToken,
        aggregateSubTokenList: aggregateGroup.aggregateSubTokenList,
        allAggregateTokenList: aggregateGroup.allAggregateTokenList,
        // Balances come from the home store cells, available under All
        // Networks; the switch only exists there, so they always show.
        hideBalanceAndValue: false,
        enableNetworkAfterSelect: true,
        closeAfterSelect: true,
        onSelect: handleSwitchNetwork,
      },
    });
  }, [
    isSwitchEnabled,
    switchEntry,
    aggregateGroup,
    navigation,
    currentAccount?.id,
    accountId,
    routeAccountId,
    indexedAccountId,
    walletId,
    handleSwitchNetwork,
    handleSelectNetworkEntry,
  ]);

  const handleSkipVerifyPress = useCallback(() => {
    setShowManualVerificationPath(false);
    Dialog.confirm({
      icon: 'ErrorOutline',
      tone: 'warning',
      title: intl.formatMessage({
        id: ETranslations.global_receive_address_confirmation,
      }),
      description: intl.formatMessage({
        id: ETranslations.global_receive_address_confirmation_desc,
      }),
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_receive_address_confirmation_button,
      }),
      onConfirm: () => {
        setAddressState(EAddressState.ForceShow);
      },
      confirmButtonProps: {
        variant: 'secondary',
      },
    });
  }, [intl]);

  const renderVerifyFooter = useCallback(() => {
    if (platformEnv.isNative) {
      return (
        <Page.Footer safeAreaBottomMode="content">
          <YStack p="$5" pb={bottom || '$5'} gap="$2.5" bg="$bgApp">
            <Button
              testID={ReceiveTestIDs.VerifyOnDeviceButton}
              variant="primary"
              size="large"
              loading={isVerifying}
              onPress={handleVerifyOnDevicePressDebounced}
            >
              {intl.formatMessage({
                id: ETranslations.global_verify_on_device,
              })}
            </Button>
            <Button
              testID={ReceiveTestIDs.SkipVerifyButton}
              size="large"
              onPress={handleSkipVerifyPress}
            >
              {intl.formatMessage({
                id: ETranslations.no_device_with_me__action,
              })}
            </Button>
          </YStack>
        </Page.Footer>
      );
    }

    return (
      <Page.Footer
        onConfirm={() => handleVerifyOnDevicePressDebounced()}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_verify_on_device,
        })}
        confirmButtonProps={{
          variant: 'primary',
          loading: isVerifying,
          testID: ReceiveTestIDs.VerifyOnDeviceButton,
        }}
        // keep one declared param: FooterCancelButton auto-closes the page
        // when the handler declares zero params
        onCancel={(_close) => handleSkipVerifyPress()}
        onCancelText={intl.formatMessage({
          id: ETranslations.no_device_with_me__action,
        })}
        cancelButtonProps={{
          testID: ReceiveTestIDs.SkipVerifyButton,
        }}
      />
    );
  }, [
    bottom,
    handleSkipVerifyPress,
    handleVerifyOnDevicePressDebounced,
    intl,
    isVerifying,
  ]);

  const deriveTypeTrigger = useMemo(() => {
    if (!currentDeriveInfo) {
      return undefined;
    }
    const label = currentDeriveInfo.labelKey
      ? intl.formatMessage({ id: currentDeriveInfo.labelKey })
      : currentDeriveInfo.label;
    // With no list to open this is a plain label, so it must not react to
    // hover or press like a button.
    if (disableSelector) {
      return (
        <SizableText
          testID={ReceiveTestIDs.AddressTypeSelector}
          size="$bodyMdMedium"
          color="$textSubdued"
        >
          {label}
        </SizableText>
      );
    }
    return (
      <Button
        testID={ReceiveTestIDs.AddressTypeSelector}
        variant="tertiary"
        size="small"
        childrenAsText={false}
      >
        <XStack alignItems="center" gap="$0.5">
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            {label}
          </SizableText>
          <Icon name="ChevronDownSmallOutline" size="$4" color="$iconSubdued" />
        </XStack>
      </Button>
    );
  }, [currentDeriveInfo, disableSelector, intl]);

  const cardHeaderLeft = useMemo(() => {
    if (!network) return null;

    const label = arrivalTimeText
      ? `${network.name} (${arrivalTimeText})`
      : network.name;
    // Same avatar as the rows of the network pickers this header opens.
    const avatar = (
      <NetworkAvatarBase
        logoURI={network.logoURI}
        isCustomNetwork={network.isCustomNetwork}
        networkName={network.name}
        size="$5"
      />
    );

    if (!isNetworkSwitchable) {
      return (
        <XStack flexShrink={1} alignItems="center" gap="$2">
          {avatar}
          <SizableText
            testID={ReceiveTestIDs.CardHeaderNetworkEta}
            size="$bodyMdMedium"
            numberOfLines={1}
            flexShrink={1}
          >
            {label}
          </SizableText>
        </XStack>
      );
    }

    // Main text color + chevron: the primary control of the header, as
    // opposed to the subdued address-type dropdown on the right. Same 32pt
    // height as that small tertiary button so the hover plate matches.
    return (
      <XStack
        testID={ReceiveTestIDs.CardHeaderNetworkTrigger}
        flexShrink={1}
        alignItems="center"
        gap="$2"
        h="$8"
        mx={-8}
        px="$2"
        borderRadius="$2"
        userSelect="none"
        disabled={!isSwitchEnabled}
        opacity={isSwitchEnabled ? 1 : 0.5}
        onPress={handleOpenNetworkSelector}
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        focusable
        focusVisibleStyle={{
          outlineWidth: 2,
          outlineColor: '$focusRing',
          outlineOffset: 0,
          outlineStyle: 'solid',
        }}
      >
        {avatar}
        <XStack flexShrink={1} alignItems="center" gap="$0.5">
          <SizableText
            testID={ReceiveTestIDs.CardHeaderNetworkEta}
            size="$bodyMdMedium"
            numberOfLines={1}
            flexShrink={1}
          >
            {label}
          </SizableText>
          <Icon name="ChevronDownSmallOutline" size="$5" color="$iconSubdued" />
        </XStack>
      </XStack>
    );
  }, [
    network,
    arrivalTimeText,
    isNetworkSwitchable,
    isSwitchEnabled,
    handleOpenNetworkSelector,
  ]);

  // Placeholder while a switch resolves: header stays, no stale address.
  const renderPlaceholderCard = useCallback(() => {
    if (!network) return null;
    const qrSize = platformEnv.isNative ? 208 : 176;
    return (
      <ReceiveCard
        testID={ReceiveTestIDs.SwitchPlaceholder}
        headerLeft={cardHeaderLeft}
      >
        <ReceiveCardCell
          alignItems="center"
          justifyContent="center"
          py={27}
          px="$4"
        >
          <Skeleton w={qrSize} h={qrSize} radius={12} />
        </ReceiveCardCell>
        <ReceiveCardCell>
          <YStack px="$4" py="$3" gap="$2">
            <Skeleton w="100%" h="$4" />
            <Skeleton w="60%" h="$4" />
          </YStack>
        </ReceiveCardCell>
      </ReceiveCard>
    );
  }, [network, cardHeaderLeft]);

  const cardHeaderRight = useMemo(() => {
    // Switch between the two receive forms of the same account.
    // A chain with no public pool (Monero) has nothing to switch to; showing
    // the control would offer a form that cannot produce an address.
    const publicFormLabel = localWalletAddressForms?.publicLabel;
    if (
      localWalletPrivateAddress &&
      localWalletAddressForms &&
      publicFormLabel
    ) {
      return (
        <SegmentControl
          value={receiveAddressForm}
          onChange={(v) => setReceiveAddressForm(v as 'public' | 'private')}
          options={[
            {
              label: intl.formatMessage({ id: publicFormLabel }),
              value: 'public',
            },
            {
              label: intl.formatMessage({
                id: localWalletAddressForms.privateLabel,
              }),
              value: 'private',
            },
          ]}
        />
      );
    }
    if (!vaultSettings?.mergeDeriveAssetsEnabled || !currentAccount) {
      return null;
    }
    // The selector saves the choice before calling back, so the callback can
    // arrive after the page moved to another network: it only applies to the
    // target this selector was rendered for.
    const renderedSwitchSeq = switchSeqRef.current;
    const isStillRenderedTarget = () =>
      renderedSwitchSeq === switchSeqRef.current &&
      committedTargetRef.current.networkId === networkId &&
      committedTargetRef.current.accountId === accountId;

    return (
      <AddressTypeSelector
        testID={ReceiveTestIDs.AddressTypeSelector}
        placement="bottom-end"
        offset={{
          mainAxis: 8,
        }}
        disableSelector={disableSelector}
        activeDeriveType={currentDeriveType}
        activeDeriveInfo={currentDeriveInfo}
        showTriggerWhenDisabled
        whenCollapsed="hide"
        renderSelectorTrigger={deriveTypeTrigger}
        walletId={walletId}
        networkId={networkId}
        indexedAccountId={currentAccount?.indexedAccountId ?? ''}
        onSelect={async (value) => {
          if (value.account && isStillRenderedTarget()) {
            resetVerifyState();
            setCurrentAccount(value.account);
            setCurrentDeriveType(value.deriveType);
            setCurrentDeriveInfo(value.deriveInfo);
            onDeriveTypeChange?.(value.deriveType);
          }
        }}
      />
    );
  }, [
    intl,
    localWalletAddressForms,
    localWalletPrivateAddress,
    receiveAddressForm,
    vaultSettings?.mergeDeriveAssetsEnabled,
    currentAccount,
    disableSelector,
    currentDeriveType,
    currentDeriveInfo,
    deriveTypeTrigger,
    walletId,
    networkId,
    accountId,
    onDeriveTypeChange,
    resetVerifyState,
  ]);

  const renderNativeActionsFooter = useCallback(() => {
    return (
      <Page.Footer safeAreaBottomMode="content">
        <YStack p="$5" pb={bottom || '$5'} bg="$bgApp">
          <XStack gap="$2.5">
            {canShowShareEntry ? (
              <Button
                testID={ReceiveTestIDs.ShareButton}
                flex={1}
                size="large"
                icon="ShareOutline"
                loading={isPreparingShare}
                onPress={handleSharePress}
              >
                {intl.formatMessage({ id: ETranslations.explore_share })}
              </Button>
            ) : null}
            <Button
              testID={ReceiveTestIDs.CopyAddressButton}
              flex={1}
              variant="primary"
              size="large"
              onPress={handleCopyAddress}
            >
              {intl.formatMessage({ id: ETranslations.global_copy_address })}
            </Button>
          </XStack>
        </YStack>
      </Page.Footer>
    );
  }, [
    bottom,
    canShowShareEntry,
    handleSharePress,
    handleCopyAddress,
    isPreparingShare,
    intl,
  ]);

  const renderPageFooter = useCallback(() => {
    if (!currentAccount || !network || !wallet) return null;

    if (isHardwareWallet && !shouldShowAddress) {
      return renderVerifyFooter();
    }

    if (platformEnv.isNative && shouldShowQRCode && displayAddress) {
      return renderNativeActionsFooter();
    }

    return null;
  }, [
    currentAccount,
    network,
    wallet,
    isHardwareWallet,
    shouldShowAddress,
    shouldShowQRCode,
    displayAddress,
    renderVerifyFooter,
    renderNativeActionsFooter,
  ]);

  const renderQrCodeCell = useCallback(() => {
    if (!displayAddress || !network) return null;

    return (
      <ReceiveCardCell
        alignItems="center"
        justifyContent="center"
        py={27}
        px="$4"
        {...(!shouldShowQRCode &&
          !isVerifying && {
            onPress: handleVerifyOnDevicePressDebounced,
            userSelect: 'none',
            hoverStyle: {
              bg: '$bgHover',
            },
            pressStyle: {
              bg: '$bgActive',
            },
            focusable: true,
            focusVisibleStyle: {
              outlineWidth: 2,
              outlineColor: '$focusRing',
              outlineOffset: 2,
              outlineStyle: 'solid',
            },
          })}
      >
        {shouldShowQRCode ? (
          <YStack testID={ReceiveTestIDs.QRCode}>
            <ReceiveQRCode
              value={displayAddress}
              size={platformEnv.isNative ? 208 : 176}
            />
          </YStack>
        ) : (
          <Empty
            p="0"
            illustration="ShieldDevice"
            description={intl.formatMessage({
              id: ETranslations.verify_on_device_confirm_address__desc,
            })}
            iconProps={{
              size: '$8',
              mb: '$5',
            }}
            descriptionProps={{
              size: '$bodyLgMedium',
              color: '$text',
            }}
          />
        )}
      </ReceiveCardCell>
    );
  }, [
    intl,
    displayAddress,
    network,
    shouldShowQRCode,
    handleVerifyOnDevicePressDebounced,
    isVerifying,
  ]);

  const isPressable = useMemo(() => {
    return !!(banner?.href || banner?.mode);
  }, [banner?.href, banner?.mode]);
  return (
    <Page
      testID={ReceiveTestIDs.ReceiveTokenPage}
      safeAreaEnabled={false}
      scrollEnabled
    >
      <Page.Header
        title=""
        headerRight={renderHeaderRight}
        headerRightNoGlass
      />
      <Page.Body px="$5" py="$5" $md={{ py: '$0' }}>
        <YStack width="100%" maxWidth={384} alignSelf="center" gap="$5">
          <YStack gap="$2" alignItems="center">
            <ReceiveTitle
              testID={ReceiveTestIDs.PageHeading}
              title={pageTitleText}
              logo={titleLogo}
            />
            {network ? (
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                textAlign="center"
              >
                <FormattedMessage
                  id={ETranslations.receive_send_asset_warning_message}
                  values={{
                    network: (
                      <SizableText size="$bodyMdMedium">
                        {networkDisplayName}
                      </SizableText>
                    ),
                  }}
                />
              </SizableText>
            ) : null}
          </YStack>
          {currentAccount && network && wallet && displayAddress ? (
            <ReceiveCard
              headerLeft={cardHeaderLeft}
              headerRight={cardHeaderRight}
            >
              {renderQrCodeCell()}
              {shouldShowAddress ? renderAddressCell() : null}
            </ReceiveCard>
          ) : null}
          {isPrivateReceiveUnavailable && network ? (
            <YStack gap="$3" alignItems="center">
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                textAlign="center"
              >
                {intl.formatMessage({
                  id: ETranslations.privacy_receive_needs_sync__msg,
                })}
              </SizableText>
              <Button
                testID="receive-open-privacy-settings"
                variant="primary"
                onPress={() =>
                  navigation.pushModal(EModalRoutes.SettingModal, {
                    screen: EModalSettingRoutes.SettingPrivacyNetwork,
                    params: { networkId: network.id, walletId },
                  })
                }
              >
                {intl.formatMessage({
                  id: ETranslations.backup_turn_on,
                })}
              </Button>
            </YStack>
          ) : null}
          {isSwitchPending && !(currentAccount && displayAddress)
            ? renderPlaceholderCard()
            : null}
          {canShowShareEntry && shareData ? (
            // offscreen: pre-generates the share image so the dialog opens
            // with the preview already resolved
            <ShareImageGenerator ref={shareGeneratorRef} data={shareData} />
          ) : null}
          {banner && shouldShowQRCode && !isBtcUsedAddressVerifyMode ? (
            <XStack
              testID={ReceiveTestIDs.Banner}
              py="$2.5"
              px="$3"
              gap="$3"
              borderWidth={StyleSheet.hairlineWidth}
              borderColor={
                networkLogoColor ? `${networkLogoColor}2A` : '$borderSubdued'
              }
              bg={networkLogoColor ? `${networkLogoColor}0D` : '$bgSubdued'}
              borderRadius={14}
              borderCurve="continuous"
              userSelect="none"
              {...(isPressable
                ? {
                    focusable: true,
                    focusVisibleStyle: {
                      outlineColor: '$focusRing',
                      outlineWidth: 2,
                      outlineStyle: 'solid',
                      outlineOffset: 0,
                    },
                    hoverStyle: {
                      bg: networkLogoColor
                        ? `${networkLogoColor}1A`
                        : '$bgHover',
                    },
                    pressStyle: {
                      bg: networkLogoColor
                        ? `${networkLogoColor}2A`
                        : '$bgActive',
                    },
                    onPress: () => handleBannerOnPress(banner),
                  }
                : undefined)}
            >
              <Image
                size="$5"
                source={{ uri: banner.src }}
                fallback={<NetworkAvatar size="$5" networkId={networkId} />}
              />
              <FormatHyperlinkText
                size="$bodyMd"
                flex={1}
                // A pressable card owns the tap: an inline <url> link hands
                // it over instead of opening its own URL, so one tap never
                // opens two pages. The link's press does not reach the card
                // (Tamagui stops propagation on web, the Text claims the
                // responder on native), so without the handoff the link
                // was a dead tap (OK-64672). A card with no action of its
                // own leaves the link to open itself.
                autoExecuteParsedAction={!isPressable}
                onAction={
                  isPressable ? () => handleBannerOnPress(banner) : undefined
                }
              >
                {banner.title}
              </FormatHyperlinkText>
            </XStack>
          ) : null}
        </YStack>
      </Page.Body>
      {renderPageFooter()}
    </Page>
  );
}

export default ReceiveToken;
