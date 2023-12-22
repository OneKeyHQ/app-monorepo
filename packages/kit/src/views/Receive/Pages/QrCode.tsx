import { useState } from 'react';

import { StyleSheet } from 'react-native';

import {
  Alert,
  Badge,
  BlurView,
  Button,
  Empty,
  Heading,
  Icon,
  Page,
  QRCode,
  Select,
  SizableText,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';

const chains = [
  { label: 'Bitcoin', value: 'Bitcoin' },
  { label: 'Ethereum', value: 'Ethereum' },
  { label: 'Lighting', value: 'Lighting' },
];

export function QrCode() {
  const [chain, setChain] = useState(chains[0].value);
  const [addressType, setAddressType] = useState('Nested SegWit');
  const [isVerified, setIsVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isShowAddress, setIsShowAddress] = useState(false);

  const headerRight = () => (
    <Select
      title="Test"
      value={chain}
      onChange={setChain}
      placement="bottom-end"
      renderTrigger={({ label }) => (
        <Button variant="tertiary" iconAfter="ChevronGrabberVerOutline">
          Test: {label}
        </Button>
      )}
      items={chains}
    />
  );

  return (
    <Page scrollEnabled>
      <Page.Header title="Receive" headerRight={headerRight} />
      <Page.Body>
        <Stack p="$5" pt="$0" my="auto" alignItems="center">
          {isShowAddress && !isVerified && (
            <SizableText color="$textCaution" mb="$2.5" textAlign="center">
              You are viewing an unverified address
            </SizableText>
          )}

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
            <QRCode value="https://onekey.so/" size={240} />
            {!isVerified && !isShowAddress && (
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
          <Stack mt="$2.5">
            {isVerified || isVerifying || isShowAddress ? (
              <Button>
                <SizableText
                  size="$bodyLg"
                  style={{
                    wordBreak: 'break-all',
                  }}
                  onPress={() =>
                    Toast.success({
                      title: 'Copied',
                    })
                  }
                >
                  37rdQk3XANNVuTvvyonUHW2eFKEHDUPCTG
                </SizableText>
              </Button>
            ) : (
              <XStack space="$2" flexWrap="wrap">
                <Button variant="primary" onPress={() => setIsVerifying(true)}>
                  Verfiy on Device
                </Button>
                <Button
                  variant="secondary"
                  onPress={() => setIsShowAddress(true)}
                >
                  Show Anyway
                </Button>
              </XStack>
            )}
          </Stack>
        </Stack>
      </Page.Body>
    </Page>
  );
}
