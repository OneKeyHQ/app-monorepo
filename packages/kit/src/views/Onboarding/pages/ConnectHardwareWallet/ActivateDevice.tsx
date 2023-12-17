import {
  Divider,
  Group,
  Heading,
  Image,
  Page,
  SizableText,
  Stack,
} from '@onekeyhq/components';

import useAppNavigation from '../../../../hooks/useAppNavigation';

const steps = [
  {
    title: 'Select "Create New Wallet"',
    description:
      "Initiate your wallet setup by selecting 'Create New Wallet.' You will be guided through creating a unique recovery phrase and setting a secure PIN.",
    uri: require('../../../../../assets/onboarding/classic-create-new-wallet.png'),
  },
  {
    title: 'Write Down All Recovery Phrase',
    description:
      "Securely record your recovery phrase and complete the check. It's crucial for accessing your wallet if you forget your PIN or lose your device.",
    uri: require('../../../../../assets/onboarding/classic-write-down-recovery-phrase.png'),
  },
  {
    title: 'Set PIN',
    description:
      'Create a strong PIN to protect your wallet just like you would with a bank card. Avoid easy sequences or repeated numbers.',
    uri: require('../../../../../assets/onboarding/classic-set-pin.png'),
  },
];

export function ActivateDevice() {
  const navigation = useAppNavigation();

  const handleConfirmPress = () => {
    navigation.pop();
  };

  return (
    <Page scrollEnabled>
      <Page.Header title="Activate Your Device" />
      <Page.Body px="$5">
        <SizableText color="$textSubdued">
          After choosing a language on your device and reviewing the basic
          guide:
        </SizableText>
        <Group separator={<Divider />}>
          {steps.map(({ title, description, uri }, index) => (
            <Group.Item key={title}>
              <Stack
                $gtMd={{
                  flexDirection: 'row',
                }}
                py="$5"
              >
                <Stack
                  h="$64"
                  $gtMd={{
                    w: '$56',
                    h: '$56',
                  }}
                  bg="$bgSubdued"
                  borderRadius="$3"
                  style={{
                    borderCurve: 'continuous',
                  }}
                >
                  <Image
                    width="100%"
                    height="$64"
                    $gtMd={{
                      w: '$56',
                      h: '$56',
                    }}
                    resizeMode="contain"
                    source={uri}
                  />
                  <SizableText
                    size="$bodySmMedium"
                    position="absolute"
                    top="$2.5"
                    left="$2.5"
                    borderRadius="$1"
                    minWidth="$5"
                    py="$0.5"
                    bg="$bgInfo"
                    color="$textInfo"
                    textAlign="center"
                  >
                    {index + 1}
                  </SizableText>
                </Stack>
                <Stack
                  flex={1}
                  pt="$5"
                  $gtMd={{
                    pt: 0,
                    pl: '$5',
                  }}
                >
                  <Heading size="$headingMd">{title}</Heading>
                  <SizableText color="$textSubdued" mt="$1">
                    {description}
                  </SizableText>
                </Stack>
              </Stack>
            </Group.Item>
          ))}
        </Group>
      </Page.Body>
      <Page.Footer onConfirmText="All Set!" onConfirm={handleConfirmPress} />
    </Page>
  );
}
