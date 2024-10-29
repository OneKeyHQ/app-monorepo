import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Badge,
  BlurView,
  Button,
  ConfirmHighlighter,
  Dialog,
  Empty,
  Heading,
  Icon,
  Page,
  QRCode,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import {
  EHardwareUiStateAction,
  useHardwareUiStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debugUtils';
import { EConfirmOnDeviceType } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAccountData } from '../../../hooks/useAccountData';
import { EAddressState } from '../types';

import type { RouteProp } from '@react-navigation/core';

function ReceiveToken() {
  useDebugComponentRemountLog({
    name: 'ReceiveToken9971',
  });
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<IModalReceiveParamList, EModalReceiveRoutes.ReceiveToken>
    >();

  const { networkId, accountId, walletId, token } = route.params;

  const { account, network, wallet, vaultSettings, addressType, deriveType } =
    useAccountData({
      accountId,
      networkId,
      walletId,
    });

  const [addressState, setAddressState] = useState<EAddressState>(
    EAddressState.Unverified,
  );

  const [hardwareUiState] = useHardwareUiStateAtom();

  const { copyText } = useClipboard();

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

  const shouldHighLightAddress = useMemo(() => {
    if (
      addressState === EAddressState.Verifying &&
      hardwareUiState?.action === EHardwareUiStateAction.REQUEST_BUTTON
    ) {
      return true;
    }
  }, [addressState, hardwareUiState?.action]);

  const isShowQRCode = useMemo(() => {
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

  const isVerifying = addressState === EAddressState.Verifying;

  const handleVerifyOnDevicePress = useCallback(async () => {
    setAddressState(EAddressState.Verifying);
    try {
      if (!deriveType) return;

      const addresses =
        await backgroundApiProxy.serviceAccount.verifyHWAccountAddresses({
          walletId,
          networkId,
          indexedAccountId: account?.indexedAccountId,
          deriveType,
          confirmOnDevice: EConfirmOnDeviceType.EveryItem,
        });

      const isSameAddress =
        addresses?.[0]?.toLowerCase() === account?.address?.toLowerCase();

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
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.feedback_address_mismatch,
          }),
          message: intl.formatMessage({
            id: ETranslations.feedback_address_mismatch_desc,
          }),
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
    account?.address,
    account?.indexedAccountId,
    deriveType,
    intl,
    networkId,
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
    if (!isHardwareWallet) {
      defaultLogger.transaction.receive.showReceived({
        walletType: wallet?.type,
        isSuccess: true,
        failedReason: '',
      });
    }
  }, [isHardwareWallet, wallet?.type]);

  const renderCopyAddressButton = useCallback(() => {
    if (isHardwareWallet) {
      if (
        addressState === EAddressState.Verified ||
        addressState === EAddressState.ForceShow ||
        isVerifying
      ) {
        return (
          <Button
            mt="$5"
            icon="Copy3Outline"
            disabled={isVerifying}
            loading={isVerifying}
            onPress={() => {
              copyText(account?.address ?? '');
            }}
          >
            {intl.formatMessage({
              id: ETranslations.global_copy_address,
            })}
          </Button>
        );
      }

      return (
        <YStack gap="$5" alignItems="center">
          <Button mt="$5" variant="primary" onPress={handleVerifyOnDevicePress}>
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
    }

    return (
      <Button
        mt="$5"
        icon="Copy3Outline"
        onPress={() => copyText(account?.address ?? '')}
      >
        {intl.formatMessage({
          id: ETranslations.global_copy_address,
        })}
      </Button>
    );
  }, [
    account?.address,
    addressState,
    copyText,
    handleVerifyOnDevicePress,
    intl,
    isHardwareWallet,
    isVerifying,
  ]);

  const renderReceiveToken = useCallback(() => {
    if (!account || !network || !wallet) return null;

    return (
      <>
        <Stack mb="$5">
          <XStack gap="$2" alignItems="center" justifyContent="center">
            <Heading size="$headingMd">
              {token?.symbol ?? network.symbol}
            </Heading>
            {vaultSettings?.showAddressType && addressType ? (
              <Badge>{addressType}</Badge>
            ) : null}
          </XStack>
          <SizableText
            mt="$1"
            size="$bodyMd"
            color="$textSubdued"
            textAlign="center"
          >
            {intl.formatMessage(
              {
                id: ETranslations.receive_send_asset_warning_message,
              },
              {
                network: network.name,
              },
            )}
          </SizableText>
        </Stack>
        <Stack
          borderRadius="$3"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
          p="$4"
        >
          <Stack position="relative">
            <QRCode
              value={account.address}
              size={240}
              logo={
                network.isCustomNetwork
                  ? undefined
                  : { uri: token?.logoURI || network.logoURI }
              }
              logoSize={network.isCustomNetwork ? undefined : 40}
            />
          </Stack>

          {!isShowQRCode ? (
            <Stack
              position="absolute"
              top="$0"
              left="$0"
              right="$0"
              bottom="$0"
              alignItems="center"
              justifyContent="center"
            >
              <BlurView
                contentStyle={{
                  borderRadius: '$3',
                  width: '100%',
                  height: '100%',
                  borderCurve: 'continuous',
                }}
                position="absolute"
                intensity={100}
                top="$0"
                left="$0"
                right="$0"
                bottom="$0"
              />
              <Empty
                icon="EyeOffOutline"
                description={intl.formatMessage({
                  id: ETranslations.address_verify_address_instruction,
                })}
              />
            </Stack>
          ) : null}
        </Stack>
        <ConfirmHighlighter
          maxWidth="$96"
          highlight={shouldHighLightAddress}
          mt="$5"
          px="$3"
          borderRadius="$3"
          borderCurve="continuous"
        >
          <SizableText
            textAlign="center"
            size="$bodyMd"
            style={{
              wordBreak: 'break-all',
            }}
          >
            {!shouldShowAddress
              ? accountUtils.shortenAddress({ address: account.address })
              : account.address}
          </SizableText>
        </ConfirmHighlighter>
        {shouldShowAddress && addressState === EAddressState.ForceShow ? (
          <XStack mt="$1" justifyContent="center" alignItems="center">
            <Icon name="InfoCircleOutline" size="$4" color="$iconCritical" />
            <SizableText size="$bodyMd" color="$textCritical" pl="$1.5">
              {intl.formatMessage({
                id: ETranslations.receive_address_unconfimed_alert_message,
              })}
            </SizableText>
          </XStack>
        ) : null}
        {renderCopyAddressButton()}
      </>
    );
  }, [
    account,
    network,
    wallet,
    vaultSettings?.showAddressType,
    addressType,
    intl,
    token?.logoURI,
    isShowQRCode,
    shouldHighLightAddress,
    shouldShowAddress,
    addressState,
    renderCopyAddressButton,
    token?.symbol,
  ]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_receive })}
      />
      <Page.Body
        flex={1}
        justifyContent="center"
        alignItems="center"
        px="$5"
        pb="$5"
      >
        {renderReceiveToken()}
      </Page.Body>
    </Page>
  );
}

export default ReceiveToken;
