import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { Linking, StyleSheet } from 'react-native';

import {
  Badge,
  Button,
  Dialog,
  Empty,
  IconButton,
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
import type {
  EModalReceiveRoutes,
  IModalReceiveParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debug/debugUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import { EConfirmOnDeviceType } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import AddressTypeSelector from '../../../components/AddressTypeSelector/AddressTypeSelector';
import { useAccountData } from '../../../hooks/useAccountData';
import { useCopyAddressWithDeriveType } from '../../../hooks/useCopyAccountAddress';
import { useHelpLink } from '../../../hooks/useHelpLink';
import { EAddressState } from '../types';

import type { RouteProp } from '@react-navigation/core';

function ReceiveToken() {
  useDebugComponentRemountLog({
    name: 'ReceiveToken9971',
  });
  const media = useMedia();
  const intl = useIntl();
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
  } = route.params;

  const { account, network, wallet, vaultSettings, deriveType, deriveInfo } =
    useAccountData({
      accountId,
      networkId,
      walletId,
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

  const { bottom } = useSafeAreaInsets();

  const [addressState, setAddressState] = useState<EAddressState>(
    EAddressState.Unverified,
  );

  const [hardwareUiState] = useHardwareUiStateAtom();

  const copyAddressWithDeriveType = useCopyAddressWithDeriveType();

  const requestsUrl = useHelpLink({ path: 'requests/new' });

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

  const handleCopyAddress = useCallback(() => {
    if (vaultSettings?.mergeDeriveAssetsEnabled && currentDeriveInfo) {
      copyAddressWithDeriveType({
        address: currentAccount?.address ?? '',
        deriveInfo: currentDeriveInfo,
        networkName: network?.shortname,
      });
    } else {
      copyAddressWithDeriveType({
        address: currentAccount?.address ?? '',
        networkName: network?.shortname,
      });
    }
  }, [
    copyAddressWithDeriveType,
    currentAccount?.address,
    currentDeriveInfo,
    network?.shortname,
    vaultSettings?.mergeDeriveAssetsEnabled,
  ]);

  const handleVerifyOnDevicePress = useCallback(async () => {
    setAddressState(EAddressState.Verifying);
    try {
      if (!currentDeriveType) return;

      const addresses =
        await backgroundApiProxy.serviceAccount.verifyHWAccountAddresses({
          walletId,
          networkId,
          indexedAccountId: currentAccount?.indexedAccountId,
          deriveType: currentDeriveType,
          confirmOnDevice: EConfirmOnDeviceType.EveryItem,
        });

      const isSameAddress =
        addresses?.[0]?.toLowerCase() ===
        currentAccount?.address?.toLowerCase();

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
    currentAccount?.address,
    currentAccount?.indexedAccountId,
    currentDeriveType,
    intl,
    networkId,
    requestsUrl,
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

  useEffect(() => {
    const fetchAccount = async () => {
      if (!accountId && networkId && indexedAccountId) {
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
      }
    };
    void fetchAccount();
  }, [
    accountId,
    currentDeriveType,
    indexedAccountId,
    networkId,
    onDeriveTypeChange,
  ]);

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

    let addressContent = '';

    if (shouldShowAddress) {
      addressContent =
        currentAccount.address.match(/.{1,4}/g)?.join(' ') ||
        currentAccount.address;
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
  }, [currentAccount, network, wallet, shouldShowAddress, handleCopyAddress]);

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
        {shouldShowAddress ? (
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
      </YStack>
    );
  }, [
    addressState,
    bottom,
    currentAccount,
    intl,
    network,
    networkId,
    onDeriveTypeChange,
    renderAddress,
    renderCopyAddressButton,
    renderVerifyAddressButton,
    shouldShowAddress,
    token?.symbol,
    vaultSettings?.mergeDeriveAssetsEnabled,
    wallet,
    walletId,
  ]);

  const renderReceiveQrCode = useCallback(() => {
    if (!currentAccount || !network || !wallet) return null;

    return (
      <YStack
        width={264}
        height={264}
        p="$5"
        mb="$6"
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
          <QRCode
            value={currentAccount.address}
            size={224}
            logo={
              network.isCustomNetwork
                ? undefined
                : { uri: token?.logoURI || network.logoURI }
            }
            logoSize={network.isCustomNetwork ? undefined : 45}
          />
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
    );
  }, [
    currentAccount,
    network,
    wallet,
    intl,
    token?.logoURI,
    shouldShowQRCode,
    handleVerifyOnDevicePress,
  ]);

  return (
    <Page safeAreaEnabled={false}>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_receive })}
      />
      <Page.Body flex={1} justifyContent="center" alignItems="center">
        {renderReceiveQrCode()}
      </Page.Body>
      <Page.Footer>{renderReceiveFooter()}</Page.Footer>
    </Page>
  );
}

export default ReceiveToken;
