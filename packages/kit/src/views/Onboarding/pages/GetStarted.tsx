import { getTokenValue } from 'tamagui';

import {
  Anchor,
  Button,
  Heading,
  Image,
  Page,
  SizableText,
  Stack,
  useSafeAreaInsets,
} from '@onekeyhq/components';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { EOnboardingPages } from '../router/type';

export function GetStarted() {
  const { bottom } = useSafeAreaInsets();

  const navigation = useAppNavigation();

  const handleCreateWalletPress = () => {
    navigation.push(EOnboardingPages.ShowRecoveryPhrase);
  };

  const handleImportWalletPress = () => {
    navigation.push(EOnboardingPages.ImportRecoveryPhrase);
  };

  return (
    <Page>
      <Page.Header headerShown={false} />
      <Page.Body>
        <Stack p="$5" flex={1}>
          <Image
            source={{
              width: 48,
              height: 48,
              uri: 'https://placehold.co/128x128/png',
            }}
          />

          <Heading
            size="$heading3xl"
            $gtMd={{
              size: '$heading4xl',
            }}
            mb="$5"
            maxWidth="$96"
          >
            Welcome to OneKey
          </Heading>
        </Stack>

        <Stack space="$2" p="$5">
          <Button
            icon="PlusCircleOutline"
            onPress={handleCreateWalletPress}
            $md={{
              size: 'large',
            }}
          >
            Create Wallet
          </Button>
          <Button
            icon="ArrowBottomCircleOutline"
            onPress={handleImportWalletPress}
            $md={{
              size: 'large',
            }}
          >
            Import Wallet
          </Button>
          <Button
            icon="UsbOutline"
            variant="primary"
            $md={{
              size: 'large',
            }}
          >
            Connect Hardware Wallet
          </Button>
        </Stack>

        <SizableText
          p="$5"
          size="$bodySm"
          color="$textSubdued"
          textAlign="center"
          {...(bottom && {
            pb: bottom + (getTokenValue('$size.5') as number),
          })}
        >
          By continuing to use the app, you agree to these{' '}
          <Anchor
            href="https://help.onekey.so/hc/articles/360002014776"
            size="$bodySm"
            target="_blank"
          >
            User Service Agreement
          </Anchor>{' '}
          and{' '}
          <Anchor
            href="https://help.onekey.so/hc/articles/360002003315"
            size="$bodySm"
            target="_blank"
          >
            Privacy Policy
          </Anchor>
        </SizableText>
      </Page.Body>
    </Page>
  );
}
