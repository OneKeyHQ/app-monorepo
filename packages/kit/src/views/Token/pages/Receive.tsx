import { useState } from 'react';

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

type IAddressState = 'unverified' | 'verifying' | 'verified' | 'forceShow';

export function Receive() {
  const [chain, setChain] = useState('Bitcoin');
  const [addressType, setAddressType] = useState('Nested SegWit');
  const [isHardwareWallet, setIsHardwareWallet] = useState(true);
  const [addressState, setAddressState] = useState<IAddressState>('unverified');

  const isShowAddress =
    !isHardwareWallet ||
    addressState === 'forceShow' ||
    addressState === 'verifying';

  const isShowQRCode =
    !isHardwareWallet ||
    addressState === 'forceShow' ||
    addressState === 'verified';

  const handleVerifyOnDevicePress = () => {
    setAddressState('verifying');
  };

  const handleCopyAddressPress = () => {
    Toast.success({
      title: 'Copied',
    });
  };

  const headerRight = () => {
    const isForceShowAction = addressState !== 'forceShow';

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
                ? setAddressState('forceShow')
                : setAddressState('unverified'),
          },
        ]}
        renderTrigger={<HeaderIconButton icon="DotHorOutline" />}
      />
    );
  };

  return (
    <Page scrollEnabled>
      <Page.Header
        title="Receive"
        headerRight={isHardwareWallet ? headerRight : undefined}
      />
      <Page.Body>
        {isShowAddress && addressState === 'forceShow' && (
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
        )}
        <Stack p="$5" pt="$0" my="auto" alignItems="center">
          <SizableText textAlign="center">
            Receive Only on{' '}
            <SizableText size="$bodyLgMedium">{chain}</SizableText>
          </SizableText>
          <Stack
            my="$5"
            p="$4"
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="$borderSubdued"
            borderRadius="$6"
            overflow="hidden"
            style={{
              borderCurve: 'continuous',
            }}
          >
            <QRCode
              value="https://onekey.so/"
              logo={{
                uri: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/btc.png',
              }}
              size={240}
            />
            {!isShowQRCode && (
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
            )}
          </Stack>

          <XStack space="$2" alignItems="center">
            <Heading size="$headingMd">Account 1</Heading>
            {addressType && <Badge>{addressType}</Badge>}
          </XStack>
          <Stack alignItems="center">
            <ConfirmHighlighter
              highlight={addressState === 'verifying'}
              my="$2.5"
              py="$1.5"
              px="$3"
              borderWidth={StyleSheet.hairlineWidth}
              borderColor="$borderSubdued"
              borderRadius="$3"
              style={{
                borderCurve: 'continuous',
              }}
            >
              <SizableText
                textAlign="center"
                size="$bodyLg"
                style={{
                  wordBreak: 'break-all',
                }}
              >
                37rdQk3XANNVuTvvyonUHW2eFKEHDUPCTG
              </SizableText>

              {!isShowAddress && (
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
              )}
            </ConfirmHighlighter>

            {isHardwareWallet &&
            (addressState === 'unverified' || addressState !== 'forceShow') ? (
              <Button
                variant="primary"
                onPress={handleVerifyOnDevicePress}
                disabled={addressState === 'verifying'}
              >
                Verfiy on Device
              </Button>
            ) : (
              <Button icon="Copy1Outline" onPress={handleCopyAddressPress}>
                Copy Address
              </Button>
            )}
          </Stack>
        </Stack>
      </Page.Body>
    </Page>
  );
}
