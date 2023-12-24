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

type IStep = {
  title?: string;
  description?: string;
  type: 'classic' | 'mini' | 'touch' | 'pro';
};

const getCreateNewWalletStep = (type: IStep['type']) => {
  const images = {
    classic: require('../../../../../assets/onboarding/classic-create-new-wallet.png'),
    mini: require('../../../../../assets/onboarding/mini-create-new-wallet.png'),
    touch: require('../../../../../assets/onboarding/touch-create-new-wallet.png'),
    pro: require('../../../../../assets/onboarding/touch-create-new-wallet.png'),
  };

  return {
    title: 'Select "Create New Wallet"',
    description:
      "Initiate your wallet setup by selecting 'Create New Wallet.' You will be guided through creating a unique recovery phrase and setting a secure PIN.",
    uri: images[type],
  };
};

const getWriteDownRecoveryPhraseStep = (type: IStep['type']) => {
  const images = {
    classic: require('../../../../../assets/onboarding/classic-write-down-recovery-phrase.png'),
    mini: require('../../../../../assets/onboarding/mini-write-down-recovery-phrase.png'),
    touch: require('../../../../../assets/onboarding/touch-write-down-recovery-phrase.png'),
    pro: require('../../../../../assets/onboarding/touch-write-down-recovery-phrase.png'),
  };

  return {
    title: 'Write Down All Recovery Phrase',
    description:
      "Securely record your recovery phrase and complete the check. It's crucial for accessing your wallet if you forget your PIN or lose your device.",
    uri: images[type],
  };
};

const getSetPinStep = (type: IStep['type']) => {
  const images = {
    classic: require('../../../../../assets/onboarding/classic-set-pin.png'),
    mini: require('../../../../../assets/onboarding/mini-set-pin.png'),
    touch: require('../../../../../assets/onboarding/touch-set-pin.png'),
    pro: require('../../../../../assets/onboarding/touch-set-pin.png'),
  };

  return {
    title: 'Set PIN',
    description:
      'Create a strong PIN to protect your wallet just like you would with a bank card. Avoid easy sequences or repeated numbers.',
    uri: images[type],
  };
};

const getImportWalletStep = (type: IStep['type']) => {
  const images = {
    classic: require('../../../../../assets/onboarding/classic-import-wallet.png'),
    mini: require('../../../../../assets/onboarding/mini-import-wallet.png'),
    touch: require('../../../../../assets/onboarding/touch-create-new-wallet.png'),
    pro: require('../../../../../assets/onboarding/touch-create-new-wallet.png'),
  };

  return {
    title:
      type === 'mini' ? 'Select "Restore Wallet"' : 'Select "Import Wallet"',
    description:
      'Follow the prompts to secure your wallet with a PIN and enter your recovery phrase to complete the process.',
    uri: images[type],
  };
};

const getEnterRecoveryPhraseStep = (type: IStep['type']) => {
  const images = {
    classic: require('../../../../../assets/onboarding/classic-enter-recovery-phrase.png'),
    mini: require('../../../../../assets/onboarding/mini-enter-recovery-phrase.png'),
    touch: require('../../../../../assets/onboarding/touch-enter-recovery-phrase.png'),
    pro: require('../../../../../assets/onboarding/touch-enter-recovery-phrase.png'),
  };

  return {
    title: 'Enter Recovery Phrase',
    description:
      'Carefully enter your recovery phrase word by word. This unique phrase is essential for the security and recovery of your wallet.',
    uri: images[type],
  };
};

const classicCreateNewWalletSteps = [
  getCreateNewWalletStep('classic'),
  getWriteDownRecoveryPhraseStep('classic'),
  getSetPinStep('classic'),
];

const classicImportWalletSteps = [
  getImportWalletStep('classic'),
  getEnterRecoveryPhraseStep('classic'),
  getSetPinStep('classic'),
];

const miniCreateNewWalletSteps = [
  getCreateNewWalletStep('mini'),
  getWriteDownRecoveryPhraseStep('mini'),
  getSetPinStep('mini'),
];

const miniImportWalletSteps = [
  getImportWalletStep('mini'),
  getEnterRecoveryPhraseStep('mini'),
  getSetPinStep('mini'),
];

const touchCreateNewWalletSteps = [
  getCreateNewWalletStep('touch'),
  getSetPinStep('touch'),
  getWriteDownRecoveryPhraseStep('touch'),
];

const touchImportWalletSteps = [
  getImportWalletStep('touch'),
  getSetPinStep('touch'),
  getEnterRecoveryPhraseStep('touch'),
];

export default function ActivateDevice() {
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
          {classicCreateNewWalletSteps.map(
            ({ title, description, uri }, index) => (
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
            ),
          )}
        </Group>
      </Page.Body>
      <Page.Footer onConfirmText="All Set!" onConfirm={handleConfirmPress} />
    </Page>
  );
}
