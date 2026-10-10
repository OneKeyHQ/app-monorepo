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
  QRCode,
  SizableText,
  Skeleton,
  Stack,
  Theme,
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IAggregateTokenSelectContext,
  IModalReceiveParamList,
  IReceiveNetworkSelection,
} from '@onekeyhq/shared/src/routes';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
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
import { NetworkAvatar } from '../../../components/NetworkAvatar';
import { Token } from '../../../components/Token';
import { useAccountData } from '../../../hooks/useAccountData';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useCopyAddressWithDeriveType } from '../../../hooks/useCopyAccountAddress';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useWalletBanner } from '../../../hooks/useWalletBanner';
import { ReceiveCard, ReceiveCardCell } from '../components/ReceiveCard';
import {
  ShareImageGenerator,
  showReceiveShareDialog,
} from '../components/ReceiveShare';
import { ReceiveTestIDs } from '../testIDs';
import { EAddressState } from '../types';
import { resolveReceiveNetworkSwitchable } from '../utils/receiveNetworkSwitchUtils';

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
    switchEntry,
    skipAggregateLookup,
    source: routeSource,
    isAllNetworksMode,
    aggregateToken: routeAggregateToken,
    aggregateSubTokenList: routeAggregateSubTokenList,
    allAggregateTokenList: routeAllAggregateTokenList,
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
  // Monotonic switch sequence: every async writer compares against it before
  // landing, so a slow lookup from an earlier switch can never win.
  const switchSeqRef = useRef(0);

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
  // them or already knows the token belongs to no group.
  const hasRouteGlobalMembers = !!routeAllAggregateTokenList?.length;
  useEffect(() => {
    if (
      switchEntry !== 'token' ||
      exchangeSource ||
      skipAggregateLookup ||
      hasRouteGlobalMembers
    ) {
      return;
    }
    let cancelled = false;
    void backgroundApiProxy.serviceToken
      .findAggregateGroupByNetworkAndAddress({
        networkId: routeNetworkId,
        address: routeToken?.address ?? '',
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
    skipAggregateLookup,
    hasRouteGlobalMembers,
    routeNetworkId,
    routeToken?.address,
  ]);

  const { result: nativeToken } = usePromiseResult(async () => {
    return backgroundApiProxy.serviceToken.getNativeToken({
      accountId,
      networkId,
    });
  }, [accountId, networkId]);

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

  const displayAddress = isBtcUsedAddressVerifyMode
    ? btcUsedAddress
    : (currentAccount?.address ?? '');
  const verificationPath = isBtcUsedAddressVerifyMode
    ? btcUsedAddressPath
    : currentAccount?.addressDetail?.receiveAddressPath;

  const { bottom } = useSafeAreaInsets();

  const [addressState, setAddressState] = useState<EAddressState>(
    EAddressState.Unverified,
  );

  const [networkLogoColor, setNetworkLogoColor] = useState<string | null>(null);

  const [hardwareUiState] = useHardwareUiStateAtom();
  const [thirdPartyHardwareUiState] = useThirdPartyHardwareUiStateAtom();

  const copyAddressWithDeriveType = useCopyAddressWithDeriveType();

  const { result: banner } = usePromiseResult(async () => {
    const banners =
      await backgroundApiProxy.serviceWalletBanner.fetchWalletBanner({
        accountId,
      });
    return banners.find(
      (_banner) =>
        _banner.position === 'receive' && _banner.networkId === networkId,
    );
  }, [accountId, networkId]);

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
      (hardwareUiState?.action === EHardwareUiStateAction.REQUEST_BUTTON ||
        thirdPartyHardwareUiState?.action ===
          EThirdPartyHardwareUiAction.confirmOnDevice)
    ) {
      return true;
    }

    return false;
  }, [
    addressState,
    hardwareUiState?.action,
    thirdPartyHardwareUiState,
    isHardwareWallet,
  ]);

  const shouldShowQRCode = useMemo(() => {
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
  }, [addressState, isHardwareWallet]);

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
    setAddressState(EAddressState.Unverified);
  }, []);

  const handleVerifyOnDevicePress = useCallback(async () => {
    if (isVerifyingRef.current) return;
    if (!currentDeriveType) return;
    if (!displayAddress) {
      setAddressState(EAddressState.Unverified);
      return;
    }
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
        });

      const isSameAddress =
        addresses?.[0]?.toLowerCase() === displayAddress.toLowerCase();

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
      if (verifyAttemptRef.current === attempt) {
        setAddressState(
          isSameAddress ? EAddressState.Verified : EAddressState.Unverified,
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
    intl,
    networkId,
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
          if (seq !== switchSeqRef.current) return;
          setCurrentDeriveInfo(deriveResp.deriveInfo);
          setCurrentDeriveType(deriveResp.deriveType);
          setCurrentAccount(accounts[0]);
          setIsSwitchPending(false);
          resolved = true;
        }
      } catch (_e) {
        // get default derive type account error, try to find the non-empty account
        const { networkAccounts } =
          await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
            {
              networkId,
              indexedAccountId,
              excludeEmptyAccount: true,
            },
          );
        if (seq !== switchSeqRef.current) return;
        const nonEmptyAccount = networkAccounts.find((item) => item.account);
        if (nonEmptyAccount) {
          setCurrentAccount(nonEmptyAccount.account);
          setCurrentDeriveType(nonEmptyAccount.deriveType);
          setCurrentDeriveInfo(nonEmptyAccount.deriveInfo);
          setIsSwitchPending(false);
          resolved = true;
        }
      }
      // After a switch the placeholder stays (the header remains tappable
      // for a retry) and the user is told; the initial mount keeps today's
      // silent behavior.
      if (!resolved && seq > 0 && seq === switchSeqRef.current) {
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
          <XStack flex={1} flexWrap="wrap">
            <HighlightAddress
              address={displayAddress}
              size="$bodyLg"
              fontFamily="$monoRegular"
            />
          </XStack>
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
  }, [displayAddress, handleCopyAddress]);

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
  // Entered by network: plain "Receive" (the page is not bound to a token).
  const pageTitleText = useMemo(
    () =>
      switchEntry === 'network'
        ? intl.formatMessage({ id: ETranslations.global_receive })
        : intl.formatMessage(
            { id: ETranslations.receive_token__title },
            { token: titleSymbol },
          ),
    [switchEntry, intl, titleSymbol],
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
      subtitle: intl.formatMessage(
        { id: ETranslations.receive_send_asset_warning_message },
        { network: networkDisplayName },
      ),
      networkName: networkDisplayName,
      address: displayAddress,
      // Network entry: a single network logo on the share image too.
      tokenLogoURI:
        switchEntry === 'network'
          ? network.logoURI
          : (token?.logoURI ?? nativeToken?.logoURI),
      networkLogoURI: switchEntry === 'network' ? undefined : network.logoURI,
    };
  }, [
    network,
    displayAddress,
    pageTitleText,
    networkDisplayName,
    intl,
    token?.logoURI,
    nativeToken?.logoURI,
    switchEntry,
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

  const renderHeaderRight = useCallback(() => {
    if (platformEnv.isNative || !canShowShareEntry) {
      return null;
    }
    return (
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
  }, [canShowShareEntry, handleSharePress, isPreparingShare, intl]);

  const { isSwitchable: isNetworkSwitchable, isSwitchEnabled } =
    resolveReceiveNetworkSwitchable({
      switchEntry,
      exchangeSource,
      isBtcUsedAddressVerifyMode: !!isBtcUsedAddressVerifyMode,
      memberCount: aggregateMembers.length,
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
      if (!targetNetworkId || targetNetworkId === networkId) {
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
      const seq = switchSeqRef.current + 1;
      switchSeqRef.current = seq;
      resetVerifyState();
      defaultLogger.transaction.receive.receiveSwitchNetwork({
        fromNetworkId: networkId,
        toNetworkId: targetNetworkId,
        source: routeSource ?? 'unknown',
        listType: switchEntry === 'network' ? 'all' : 'aggregate',
        walletType: wallet?.type,
        deviceType: wallet?.associatedDeviceInfo?.deviceType,
        createdAddress: !!selectContext?.createdAddress,
        isAllNetworksMode,
      });

      const [settings, targetNetwork] = await Promise.all([
        backgroundApiProxy.serviceNetwork.getVaultSettings({
          networkId: targetNetworkId,
        }),
        targetNetworkHint
          ? Promise.resolve(targetNetworkHint)
          : backgroundApiProxy.serviceNetwork.getNetwork({
              networkId: targetNetworkId,
            }),
      ]);
      if (seq !== switchSeqRef.current) {
        return;
      }
      // Multi-address-type chains derive the account from the indexed
      // account (same as entering with an empty accountId); other chains use
      // the account the selected row carries.
      const useDerivePath =
        !!settings.mergeDeriveAssetsEnabled &&
        !!indexedAccountId &&
        !accountUtils.isOthersWallet({ walletId });
      if (!useDerivePath && !targetAccountId) {
        Toast.error({
          title: intl.formatMessage({ id: ETranslations.global_unknown_error }),
        });
        return;
      }

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
      setCurrentNetworkId(targetNetworkId);
      setCurrentAccountId(useDerivePath ? '' : (targetAccountId ?? ''));
    },
    [
      switchEntry,
      indexedAccountId,
      intl,
      isAllNetworksMode,
      networkId,
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
          {disableSelector ? null : (
            <Icon
              name="ChevronDownSmallOutline"
              size="$4"
              color="$iconSubdued"
            />
          )}
        </XStack>
      </Button>
    );
  }, [currentDeriveInfo, disableSelector, intl]);

  const cardHeaderLeft = useMemo(() => {
    if (!network) return null;

    const label = arrivalTimeText
      ? `${network.name} (${arrivalTimeText})`
      : network.name;

    if (!isNetworkSwitchable) {
      return (
        <SizableText
          testID={ReceiveTestIDs.CardHeaderNetworkEta}
          size="$bodyMdMedium"
          numberOfLines={1}
          flexShrink={1}
        >
          {label}
        </SizableText>
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
        gap="$0.5"
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
    if (!vaultSettings?.mergeDeriveAssetsEnabled || !currentAccount) {
      return null;
    }

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
        renderSelectorTrigger={deriveTypeTrigger}
        walletId={walletId}
        networkId={networkId}
        indexedAccountId={currentAccount?.indexedAccountId ?? ''}
        onSelect={async (value) => {
          if (value.account) {
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
    vaultSettings?.mergeDeriveAssetsEnabled,
    currentAccount,
    disableSelector,
    currentDeriveType,
    currentDeriveInfo,
    deriveTypeTrigger,
    walletId,
    networkId,
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
            <QRCode
              value={displayAddress}
              size={platformEnv.isNative ? 208 : 176}
            />
            {network.isCustomNetwork ? null : (
              // The overlay sits on the QR plate, which is always light, so
              // resolve theme tokens (the network badge ring and its icon
              // backing use $bgApp) against the light theme the same way the
              // QRCode component does for the plate itself.
              <Theme name="light">
                {/* full-bleed overlay + flex centering: percentage translate
                    is unreliable on native, so avoid left/top 50% -50% here */}
                <YStack
                  position="absolute"
                  top={0}
                  left={0}
                  right={0}
                  bottom={0}
                  alignItems="center"
                  justifyContent="center"
                >
                  <YStack
                    borderWidth={4}
                    borderColor="white"
                    borderRadius="$full"
                    bg="white"
                  >
                    {switchEntry === 'network' ? (
                      // Entered by network: the page is not bound to a
                      // token, so the plate carries the network logo alone.
                      <Token size="lg" tokenImageUri={network.logoURI} />
                    ) : (
                      <Token
                        size="lg"
                        tokenImageUri={token?.logoURI ?? nativeToken?.logoURI}
                        networkImageUri={network.logoURI}
                        networkId={networkId}
                      />
                    )}
                  </YStack>
                </YStack>
              </Theme>
            )}
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
    token?.logoURI,
    networkId,
    nativeToken?.logoURI,
    switchEntry,
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
            <SizableText
              testID={ReceiveTestIDs.PageHeading}
              size="$heading2xl"
              textAlign="center"
            >
              {pageTitleText}
            </SizableText>
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
                autoExecuteParsedAction={false}
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
