import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { FormattedMessage, useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { getColors } from 'react-native-image-colors';
import { useThrottledCallback } from 'use-debounce';

import {
  Button,
  Dialog,
  Empty,
  Icon,
  Image,
  Page,
  QRCode,
  SizableText,
  Stack,
  Theme,
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
} from '@onekeyhq/kit-bg/src/vaults/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IModalReceiveParamList } from '@onekeyhq/shared/src/routes';
import { EModalReceiveRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debug/debugUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { getReceiveArrivalTimeText } from '@onekeyhq/shared/src/utils/receiveArrivalTimeUtils';
import { getReceiveNetworkDisplayName } from '@onekeyhq/shared/src/utils/receiveNetworkStandardUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import { EConfirmOnDeviceType } from '@onekeyhq/shared/types/device';

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
    networkId,
    accountId,
    indexedAccountId,
    walletId,
    token,
    onDeriveTypeChange,
    disableSelector,
    btcUsedAddress,
    btcUsedAddressPath,
    exchangeSource,
  } = route.params;

  const { account, network, wallet, vaultSettings, deriveType, deriveInfo } =
    useAccountData({
      accountId,
      networkId,
      walletId,
    });

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

  const { handleBannerOnPress } = useWalletBanner({
    account,
    network,
    wallet,
  });

  const [currentDeriveType, setCurrentDeriveType] = useState<
    IAccountDeriveTypes | undefined
  >(deriveType);

  const [currentDeriveInfo, setCurrentDeriveInfo] = useState<
    IAccountDeriveInfo | undefined
  >(deriveInfo);

  const [currentAccount, setCurrentAccount] = useState<
    INetworkAccount | undefined
  >(account);

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

  const handleVerifyOnDevicePress = useCallback(async () => {
    setAddressState(EAddressState.Verifying);
    try {
      if (!currentDeriveType) return;
      if (!displayAddress) {
        setAddressState(EAddressState.Unverified);
        return;
      }

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
      setAddressState(
        isSameAddress ? EAddressState.Verified : EAddressState.Unverified,
      );
    } catch (e: any) {
      setAddressState(EAddressState.Unverified);
      // verifyHWAccountAddresses handler error toast
      defaultLogger.transaction.receive.showReceived({
        walletType: wallet?.type,
        isSuccess: false,
        failedReason: (e as Error).message,
      });
      throw e;
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

  useEffect(() => {
    const callback = () => setAddressState(EAddressState.Unverified);
    appEventBus.on(
      EAppEventBusNames.CloseHardwareUiStateDialogManually,
      callback,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.CloseHardwareUiStateDialogManually,
        callback,
      );
    };
  }, []);

  const fetchAccount = useCallback(async () => {
    if (!accountId && networkId && indexedAccountId) {
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
          setCurrentDeriveInfo(deriveResp.deriveInfo);
          setCurrentDeriveType(deriveResp.deriveType);
          setCurrentAccount(accounts[0]);
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
        const nonEmptyAccount = networkAccounts.find((item) => item.account);
        if (nonEmptyAccount) {
          setCurrentAccount(nonEmptyAccount.account);
          setCurrentDeriveType(nonEmptyAccount.deriveType);
          setCurrentDeriveInfo(nonEmptyAccount.deriveInfo);
        }
      }
    }
  }, [accountId, indexedAccountId, networkId]);

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

  useEffect(() => {
    if (deriveInfo) {
      setCurrentDeriveInfo(deriveInfo);
    }

    if (deriveType) {
      setCurrentDeriveType(deriveType);
    }
    if (account) {
      setCurrentAccount(account);
    }
  }, [account, deriveInfo, deriveType]);

  useEffect(() => {
    if (btcUsedAddress || btcUsedAddressPath) {
      setAddressState(EAddressState.Unverified);
    }
  }, [btcUsedAddress, btcUsedAddressPath]);

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

  const pageTitleText = useMemo(
    () =>
      intl.formatMessage(
        { id: ETranslations.receive_token__title },
        { token: token?.symbol ?? network?.symbol ?? '' },
      ),
    [intl, token?.symbol, network?.symbol],
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
      tokenLogoURI: token?.logoURI ?? nativeToken?.logoURI,
      networkLogoURI: network.logoURI,
    };
  }, [
    network,
    displayAddress,
    pageTitleText,
    networkDisplayName,
    intl,
    token?.logoURI,
    nativeToken?.logoURI,
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
              onPress={handleVerifyOnDevicePress}
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
        onConfirm={() => handleVerifyOnDevicePress()}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_verify_on_device,
        })}
        confirmButtonProps={{
          variant: 'primary',
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
  }, [bottom, handleSkipVerifyPress, handleVerifyOnDevicePress, intl]);

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

    return (
      <SizableText
        testID={ReceiveTestIDs.CardHeaderNetworkEta}
        size="$bodyMdMedium"
        numberOfLines={1}
        flexShrink={1}
      >
        {arrivalTimeText
          ? `${network.name} (${arrivalTimeText})`
          : network.name}
      </SizableText>
    );
  }, [network, arrivalTimeText]);

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
            setAddressState(EAddressState.Unverified);
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
        {...(!shouldShowQRCode && {
          onPress: handleVerifyOnDevicePress,
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
                    <Token
                      size="lg"
                      tokenImageUri={token?.logoURI ?? nativeToken?.logoURI}
                      networkImageUri={network.logoURI}
                      networkId={networkId}
                    />
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
    handleVerifyOnDevicePress,
    token?.logoURI,
    networkId,
    nativeToken?.logoURI,
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
