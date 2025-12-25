import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { Linking, StyleSheet } from 'react-native';
import { getColors } from 'react-native-image-colors';
import { useThrottledCallback } from 'use-debounce';

import {
  Badge,
  Button,
  Dialog,
  Empty,
  IconButton,
  Image,
  Page,
  QRCode,
  SizableText,
  XStack,
  YStack,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import {
  EHardwareUiStateAction,
  useHardwareUiStateAtom,
  useSettingsPersistAtom,
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
import type { IModalReceiveParamList } from '@onekeyhq/shared/src/routes';
import { EModalReceiveRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debug/debugUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import { EConfirmOnDeviceType } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import AddressTypeSelector from '../../../components/AddressTypeSelector/AddressTypeSelector';
import {
  FormatHyperlinkText,
  HyperlinkText,
} from '../../../components/HyperlinkText';
import { NetworkAvatar } from '../../../components/NetworkAvatar';
import { Token } from '../../../components/Token';
import { useAccountData } from '../../../hooks/useAccountData';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useCopyAddressWithDeriveType } from '../../../hooks/useCopyAccountAddress';
import { useHelpLink } from '../../../hooks/useHelpLink';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useWalletBanner } from '../../../hooks/useWalletBanner';
import { EAddressState } from '../types';

import type { RouteProp } from '@react-navigation/core';

function ReceiveToken() {
  useDebugComponentRemountLog({
    name: 'ReceiveToken9971',
  });
  const media = useMedia();
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
    : currentAccount?.address ?? '';
  const verificationPath = isBtcUsedAddressVerifyMode
    ? btcUsedAddressPath
    : currentAccount?.addressDetail?.receiveAddressPath;

  const { bottom } = useSafeAreaInsets();

  const [addressState, setAddressState] = useState<EAddressState>(
    EAddressState.Unverified,
  );

  const [networkLogoColor, setNetworkLogoColor] = useState<string | null>(null);

  const [hardwareUiState] = useHardwareUiStateAtom();

  const copyAddressWithDeriveType = useCopyAddressWithDeriveType();

  const requestsUrl = useHelpLink({ path: 'requests/new' });

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
      hardwareUiState?.action === EHardwareUiStateAction.REQUEST_BUTTON
    ) {
      return true;
    }

    return false;
  }, [addressState, hardwareUiState?.action, isHardwareWallet]);

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

  const [{ enableBTCFreshAddress }] = useSettingsPersistAtom();
  const isEnableBTCFreshAddressSetting = useMemo(() => {
    return accountUtils.isEnabledBtcFreshAddress({
      enableBTCFreshAddress,
      networkId,
      walletId,
    });
  }, [networkId, enableBTCFreshAddress, walletId]);

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
          onConfirm: () => Linking.openURL(requestsUrl),
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
    requestsUrl,
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
      } catch (e) {
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

  const renderCopyAddressButton = useCallback(() => {
    if (
      isHardwareWallet &&
      addressState !== EAddressState.Verified &&
      addressState !== EAddressState.ForceShow
    ) {
      return null;
    }

    return (
      <IconButton
        size="medium"
        icon="Copy3Outline"
        onPress={handleCopyAddress}
        variant="primary"
      />
    );
  }, [addressState, handleCopyAddress, isHardwareWallet]);

  const renderVerifyAddressButton = useCallback(() => {
    if (!isHardwareWallet || shouldShowAddress) return null;

    return (
      <YStack
        mt="$5"
        alignItems="center"
        justifyContent="space-between"
        flexDirection="row-reverse"
        $md={{
          flexDirection: 'column',
          gap: '$5',
          mt: '0',
          justifyContent: 'center',
        }}
      >
        <Button
          variant="primary"
          size={media.gtMd ? 'medium' : 'large'}
          onPress={handleVerifyOnDevicePress}
          $md={{
            width: '100%',
          }}
        >
          {intl.formatMessage({
            id: ETranslations.global_verify_on_device,
          })}
        </Button>
        <Button
          size="medium"
          variant="tertiary"
          onPress={() => {
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
          }}
        >
          {intl.formatMessage({
            id: ETranslations.skip_verify_text,
          })}
        </Button>
      </YStack>
    );
  }, [
    handleVerifyOnDevicePress,
    intl,
    isHardwareWallet,
    media.gtMd,
    shouldShowAddress,
  ]);

  const renderAddress = useCallback(() => {
    if (!currentAccount || !network || !wallet) return null;
    if (!displayAddress) return null;

    let addressContent = '';

    if (shouldShowAddress) {
      addressContent =
        displayAddress.match(/.{1,4}/g)?.join(' ') || displayAddress;
    } else {
      addressContent = Array.from({ length: 11 })
        .map(() => '****')
        .join(' ');
    }

    return (
      <XStack
        maxWidth={304}
        flexWrap="wrap"
        {...(shouldShowAddress && {
          onPress: handleCopyAddress,
          userSelect: 'none',
          py: '$1',
          px: '$2',
          mx: '$-2',
          my: '$-1',
          borderRadius: '$2',
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
        <SizableText fontFamily="$monoMedium">{addressContent}</SizableText>
      </XStack>
    );
  }, [
    currentAccount,
    displayAddress,
    network,
    wallet,
    shouldShowAddress,
    handleCopyAddress,
  ]);

  const renderReceiveFooter = useCallback(() => {
    if (!currentAccount || !network || !wallet) return null;

    return (
      <YStack
        backgroundColor="$bgSubdued"
        padding="$5"
        pb={bottom || '$5'}
        gap="$5"
        $platform-native={{
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: '$neutral3',
        }}
        $theme-dark={{
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: '$neutral3',
        }}
        $platform-web={{
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.10) inset',
        }}
      >
        <YStack gap="$1.5">
          <XStack gap="$2" alignItems="center">
            <SizableText size="$bodyMd">
              {token?.symbol ?? network.symbol}
            </SizableText>
            <Badge>
              <Badge.Text>{network.name}</Badge.Text>
            </Badge>
            {vaultSettings?.mergeDeriveAssetsEnabled ? (
              <AddressTypeSelector
                placement="top-start"
                offset={{
                  mainAxis: 8,
                }}
                disableSelector={disableSelector}
                activeDeriveType={currentDeriveType}
                activeDeriveInfo={currentDeriveInfo}
                showTriggerWhenDisabled
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
            ) : null}
            {shouldShowAddress && addressState === EAddressState.ForceShow ? (
              <Badge badgeType="critical">
                {intl.formatMessage({
                  id: ETranslations.receive_address_unconfirmed_alert_message,
                })}
              </Badge>
            ) : null}
          </XStack>
          <XStack gap="$2" alignItems="center" justifyContent="space-between">
            {renderAddress()}
            {renderCopyAddressButton()}
          </XStack>
        </YStack>
        {renderVerifyAddressButton()}
        {shouldShowAddress && !isEnableBTCFreshAddressSetting ? (
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage(
              {
                id: ETranslations.receive_send_asset_warning_message,
              },
              {
                network: network.name,
              },
            )}
          </SizableText>
        ) : null}
        {shouldShowAddress &&
        isEnableBTCFreshAddressSetting &&
        !isBtcUsedAddressVerifyMode ? (
          <HyperlinkText
            flexShrink={1}
            color="$textSubdued"
            size="$bodyMd"
            translationId={ETranslations.wallet_receive_note_fresh_address}
            autoHandleResult={false}
            onAction={() => {
              console.log('HyperlinkText onAction');
              navigation.push(EModalReceiveRoutes.BtcAddresses, {
                networkId,
                accountId: currentAccount?.id,
                deriveInfo: currentDeriveInfo,
                walletId,
              });
            }}
            boldTextProps={{
              size: '$bodyMd',
            }}
          />
        ) : null}
      </YStack>
    );
  }, [
    addressState,
    bottom,
    currentAccount,
    currentDeriveInfo,
    currentDeriveType,
    intl,
    network,
    networkId,
    onDeriveTypeChange,
    renderAddress,
    renderCopyAddressButton,
    renderVerifyAddressButton,
    shouldShowAddress,
    isEnableBTCFreshAddressSetting,
    disableSelector,
    token?.symbol,
    vaultSettings?.mergeDeriveAssetsEnabled,
    wallet,
    walletId,
    navigation,
    isBtcUsedAddressVerifyMode,
  ]);

  const renderReceiveQrCode = useCallback(() => {
    if (!currentAccount || !network || !wallet) return null;
    if (!displayAddress) return null;

    return (
      <YStack flex={1} justifyContent="center" alignItems="center">
        <YStack
          width={264}
          height={264}
          p="$5"
          alignItems="center"
          justifyContent="center"
          bg="white"
          borderRadius="$3"
          borderCurve="continuous"
          $platform-native={{
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: '$borderSubdued',
          }}
          $platform-web={{
            boxShadow:
              '0 8px 12px -4px rgba(0, 0, 0, 0.08), 0 0 2px 0 rgba(0, 0, 0, 0.10), 0 1px 2px 0 rgba(0, 0, 0, 0.10)',
          }}
          elevation={0.5}
          {...(!shouldShowQRCode && {
            onPress: handleVerifyOnDevicePress,
            userSelect: 'none',
            bg: '$bg',
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
            <YStack>
              <QRCode value={displayAddress} size={224} />
              {network.isCustomNetwork ? null : (
                <YStack
                  position="absolute"
                  left="50%"
                  top="50%"
                  transform={[{ translateX: '-50%' }, { translateY: '-50%' }]}
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
              )}
            </YStack>
          ) : null}

          {!shouldShowQRCode ? (
            <Empty
              p="0"
              icon="QrCodeOutline"
              description={intl.formatMessage({
                id: ETranslations.address_verify_address_instruction,
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
          ) : null}
        </YStack>
      </YStack>
    );
  }, [
    currentAccount,
    displayAddress,
    network,
    wallet,
    shouldShowQRCode,
    handleVerifyOnDevicePress,
    token?.logoURI,
    networkId,
    intl,
    nativeToken?.logoURI,
  ]);

  const isPressable = useMemo(() => {
    return !!(banner?.href || banner?.mode);
  }, [banner?.href, banner?.mode]);
  return (
    <Page safeAreaEnabled={false}>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_receive })}
      />
      <Page.Body flex={1} pb="$5" px="$5">
        {renderReceiveQrCode()}
        <YStack gap="$2">
          {banner && shouldShowQRCode && !isBtcUsedAddressVerifyMode ? (
            <XStack
              py="$2.5"
              px="$3"
              gap="$3"
              borderWidth={StyleSheet.hairlineWidth}
              borderColor={
                networkLogoColor ? `${networkLogoColor}2A` : '$borderSubdued'
              }
              bg={networkLogoColor ? `${networkLogoColor}0D` : '$bgSubdued'}
              borderRadius="$2"
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
              <FormatHyperlinkText size="$bodyMd" flex={1}>
                {banner.title}
              </FormatHyperlinkText>
            </XStack>
          ) : null}
        </YStack>
      </Page.Body>
      <Page.Footer>{renderReceiveFooter()}</Page.Footer>
    </Page>
  );
}

export default ReceiveToken;
