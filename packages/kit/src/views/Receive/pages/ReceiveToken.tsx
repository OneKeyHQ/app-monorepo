import { useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  ActionList,
  Badge,
  BlurView,
  Button,
  ConfirmHighlighter,
  Empty,
  Heading,
  Icon,
  Page,
  QRCode,
  SizableText,
  Stack,
  Toast,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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

  const { networkId, accountId, walletId, deriveInfo, deriveType } =
    route.params;

  const addressType = deriveInfo?.labelKey
    ? intl.formatMessage({
        id: deriveInfo?.labelKey,
      })
    : deriveInfo?.label ?? '';

  const { account, network, wallet } = useAccountData({
    accountId,
    networkId,
    walletId,
  });

  const [addressState, setAddressState] = useState<EAddressState>(
    EAddressState.Unverified,
  );

  const { copyText } = useClipboard();

  const isDeviceWallet =
    accountUtils.isQrWallet({
      walletId,
    }) ||
    accountUtils.isHwWallet({
      walletId,
    });

  const isShowAddress =
    !isDeviceWallet ||
    addressState === EAddressState.ForceShow ||
    addressState === EAddressState.Verified;

  const isShowQRCode =
    !isDeviceWallet ||
    addressState === EAddressState.ForceShow ||
    addressState === EAddressState.Verified;

  const handleVerifyOnDevicePress = useCallback(async () => {
    setAddressState(EAddressState.Verifying);
    try {
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
      throw e;
    }
  }, [
    account?.address,
    account?.indexedAccountId,
    deriveType,
    intl,
    networkId,
    walletId,
  ]);

  const headerRight = () => {
    const isForceShowAction = addressState !== EAddressState.ForceShow;

    if (addressState === EAddressState.Verified) return null;

    return (
      <ActionList
        title={intl.formatMessage({ id: ETranslations.global_more })}
        items={[
          {
            icon: isForceShowAction ? 'EyeOutline' : 'EyeOffOutline',
            label: isForceShowAction
              ? intl.formatMessage({
                  id: ETranslations.receive_show_address_any,
                })
              : intl.formatMessage({
                  id: ETranslations.receive_hide_unverified_address,
                }),
            onPress: () =>
              isForceShowAction
                ? setAddressState(EAddressState.ForceShow)
                : setAddressState(EAddressState.Unverified),
          },
        ]}
        renderTrigger={<HeaderIconButton icon="DotHorOutline" />}
      />
    );
  };

  const renderReceiveToken = useCallback(() => {
    if (!account || !network || !wallet) return null;

    return (
      <>
        <Stack mb="$5">
          <XStack space="$2" alignItems="center" justifyContent="center">
            <Heading size="$headingMd">{network.name}</Heading>
            {addressType ? <Badge>{addressType}</Badge> : null}
          </XStack>
          <SizableText
            mt="$1"
            size="$bodyMd"
            color="$textSubdued"
            textAlign="center"
          >
            {intl.formatMessage({
              id: ETranslations.receive_send_asset_warning_message,
            })}
          </SizableText>
        </Stack>
        <Stack
          borderRadius="$3"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
          p="$4"
        >
          <QRCode
            value={account.address}
            logo={{
              uri: network.logoURI,
            }}
            logoSize={40}
            size={240}
          />
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
          highlight={addressState === EAddressState.Verifying}
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
            {account.address}
          </SizableText>

          {!isShowAddress ? (
            <BlurView
              // Setting both inner and outer borderRadius is for the compatibility of Web and Native styles.
              borderRadius="$3"
              contentStyle={{
                borderRadius: '$3',
                width: '100%',
                height: '100%',
                borderCurve: 'continuous',
              }}
              position="absolute"
              intensity={38}
              top="$0"
              left="$0"
              right="$0"
              bottom="$0"
            />
          ) : null}
        </ConfirmHighlighter>
        {isShowAddress && addressState === EAddressState.ForceShow ? (
          <XStack mt="$1" justifyContent="center" alignItems="center">
            <Icon name="InfoCircleOutline" size="$4" color="$iconCritical" />
            <SizableText size="$bodyMd" color="$textCritical" pl="$1.5">
              {intl.formatMessage({
                id: ETranslations.receive_address_unconfimed_alert_message,
              })}
            </SizableText>
          </XStack>
        ) : null}
        {isDeviceWallet &&
        (addressState === EAddressState.Unverified ||
          addressState === EAddressState.Verifying) ? (
          <Button mt="$5" variant="primary" onPress={handleVerifyOnDevicePress}>
            {intl.formatMessage({
              id: ETranslations.global_verify_on_device,
            })}
          </Button>
        ) : (
          <Button
            mt="$5"
            icon="Copy1Outline"
            onPress={() => copyText(account.address)}
          >
            {intl.formatMessage({
              id: ETranslations.global_copy_address,
            })}
          </Button>
        )}
      </>
    );
  }, [
    account,
    addressState,
    addressType,
    copyText,
    handleVerifyOnDevicePress,
    intl,
    isDeviceWallet,
    isShowAddress,
    isShowQRCode,
    network,
    wallet,
  ]);

  useEffect(() => {}, [account?.indexedAccountId]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_receive })}
        headerRight={isDeviceWallet ? headerRight : undefined}
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
