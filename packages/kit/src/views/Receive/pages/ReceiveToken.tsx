import { useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { StyleSheet } from 'react-native';

import {
  ActionList,
  Alert,
  Badge,
  BlurView,
  Button,
  ConfirmHighlighter,
  Empty,
  Heading,
  Page,
  QRCode,
  SizableText,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { WALLET_TYPE_HW } from '@onekeyhq/shared/src/consts/dbConsts';
import type {
  EModalReceiveRoutes,
  IModalReceiveParamList,
} from '@onekeyhq/shared/src/routes';

import { useAccountData } from '../../../hooks/useAccountData';
import { EAddressState } from '../types';

import type { RouteProp } from '@react-navigation/core';

function ReceiveToken() {
  const route =
    useRoute<
      RouteProp<IModalReceiveParamList, EModalReceiveRoutes.ReceiveToken>
    >();

  const { networkId, accountId, walletId, addressType } = route.params;

  const { account, network, wallet } = useAccountData({
    accountId,
    networkId,
    walletId,
  });

  const [addressState, setAddressState] = useState<EAddressState>(
    EAddressState.Unverified,
  );

  const isHardwareWallet = wallet?.type === WALLET_TYPE_HW;

  const isShowAddress =
    !isHardwareWallet ||
    addressState === EAddressState.ForceShow ||
    addressState === EAddressState.Verifying;

  const isShowQRCode =
    !isHardwareWallet ||
    addressState === EAddressState.ForceShow ||
    addressState === EAddressState.Verified;

  const handleVerifyOnDevicePress = () => {
    setAddressState(EAddressState.Verifying);
  };

  const handleCopyAddressPress = () => {
    Toast.success({
      title: 'Copied',
    });
  };

  const headerRight = () => {
    const isForceShowAction = addressState !== EAddressState.ForceShow;

    return (
      <ActionList
        title="Options"
        items={[
          {
            icon: isForceShowAction ? 'EyeOutline' : 'EyeOffOutline',
            label: isForceShowAction
              ? 'Show Address Anyway'
              : 'Hide Unverfied Address',
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
        {isShowAddress && addressState === EAddressState.ForceShow ? (
          <Alert
            fullBleed
            icon="InfoCircleOutline"
            type="critical"
            title="Address Unconfirmed. Verify to Ensure Security."
            action={{
              primary: 'Verify',
              onPrimaryPress: () => handleVerifyOnDevicePress(),
            }}
            mb="$5"
          />
        ) : null}
        <Stack p="$5" pt="$0" my="auto" alignItems="center">
          <SizableText textAlign="center">
            Receive Only on{' '}
            <SizableText size="$bodyLgMedium">{network.name}</SizableText>
          </SizableText>
          <Stack
            my="$5"
            p="$4"
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="$borderSubdued"
            borderRadius="$6"
            overflow="hidden"
            borderCurve="continuous"
          >
            <QRCode
              value={account.address}
              logo={{
                uri: network.logoURI,
              }}
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
                    borderRadius: '$6',
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
                  icon="ShieldOutline"
                  description="Verify address on device to prevent phishing"
                />
              </Stack>
            ) : null}
          </Stack>

          <XStack space="$2" alignItems="center">
            <Heading size="$headingMd">{account.name}</Heading>
            {addressType ? <Badge>{addressType}</Badge> : null}
          </XStack>
          <Stack alignItems="center">
            <ConfirmHighlighter
              highlight={addressState === EAddressState.Verifying}
              my="$2.5"
              py="$1.5"
              px="$3"
              borderWidth={StyleSheet.hairlineWidth}
              borderColor="$borderSubdued"
              borderRadius="$3"
              borderCurve="continuous"
            >
              <SizableText
                textAlign="center"
                size="$bodyLg"
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

            {isHardwareWallet &&
            (addressState === EAddressState.Unverified ||
              addressState !== EAddressState.ForceShow) ? (
              <Button
                variant="primary"
                onPress={handleVerifyOnDevicePress}
                disabled={addressState === EAddressState.Verifying}
              >
                Verify on Device
              </Button>
            ) : (
              <Button icon="Copy1Outline" onPress={handleCopyAddressPress}>
                Copy Address
              </Button>
            )}
          </Stack>
        </Stack>
      </>
    );
  }, [
    account,
    addressState,
    addressType,
    isHardwareWallet,
    isShowAddress,
    isShowQRCode,
    network,
    wallet,
  ]);

  useEffect(() => {}, [account?.indexedAccountId]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title="Receive"
        headerRight={isHardwareWallet ? headerRight : undefined}
      />
      <Page.Body>{renderReceiveToken()}</Page.Body>
    </Page>
  );
}

export { ReceiveToken };
