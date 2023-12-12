import { StyleSheet } from 'react-native';

import {
  Anchor,
  Button,
  Divider,
  Group,
  Heading,
  Image,
  ListItem,
  Page,
  SizableText,
  YGroup,
} from '@onekeyhq/components';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { EOnboardingPages } from '../router/type';

export function GetStarted() {
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
      <Page.Body p="$5">
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
          Set up with a OneKey Hardware Wallet?
        </Heading>
        <Group
          bg="$bg"
          borderWidth={StyleSheet.hairlineWidth}
          borderRadius="$3"
          borderColor="$borderSubdued"
          separator={<Divider />}
        >
          <Group.Item>
            <ListItem
              px="$3"
              mx="$0"
              onPress={handleCreateWalletPress}
              icon="PlusCircleOutline"
              title="Create Wallet"
              drillIn
            />
          </Group.Item>
          <Group.Item>
            <ListItem
              px="$3"
              mx="$0"
              icon="ArrowBottomCircleOutline"
              onPress={handleImportWalletPress}
              title="Import Wallet"
              drillIn
            />
          </Group.Item>
        </Group>
        <YGroup>
          <Button>Connect Hardware Wallet</Button>
        </YGroup>

        <SizableText
          size="$bodySm"
          color="$textSubdued"
          mt="auto"
          textAlign="center"
        >
          By continuing to use the app, you agree to these{' '}
          <Anchor
            href="https://help.onekey.so/hc/articles/360002014776"
            size="$bodySm"
            color="$textSubdued"
          >
            User Service Agreement
          </Anchor>{' '}
          and{' '}
          <Anchor
            href="https://help.onekey.so/hc/articles/360002003315"
            size="$bodySm"
            color="$textSubdued"
          >
            Privacy Policy
          </Anchor>
          .
        </SizableText>
      </Page.Body>
    </Page>
  );
}
