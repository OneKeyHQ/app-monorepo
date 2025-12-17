import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Divider,
  Form,
  Icon,
  Input,
  Page,
  SizableText,
  XStack,
  YStack,
  useForm,
} from '@onekeyhq/components';

import { ListItem } from '../../../components/ListItem';
import { OnboardingLayout } from '../components/OnboardingLayout';

function OptionItem({
  icon,
  title,
  onPress,
}: {
  icon: IKeyOfIcons;
  title: string;
  onPress: () => void;
}) {
  return (
    <ListItem
      py={10}
      m="$0"
      gap="$2"
      drillIn
      borderWidth={1}
      borderColor="$borderStrong"
      $platform-web={{
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      }}
      // $theme-dark={{
      //   bg: '$neutral2',
      //   borderWidth: 1,
      //   borderColor: '$borderStrong',
      // }}
      // $platform-native={{
      //   borderWidth: 1,
      //   borderColor: '$borderSubdued',
      // }}
      userSelect="none"
      onPress={onPress}
    >
      <Icon name={icon} color="$iconActive" size="$5" />
      <ListItem.Text flex={1} primary={title} />
    </ListItem>
  );
}

function OneKeyIDLoginPage() {
  const form = useForm<{ email: string }>({
    defaultValues: { email: '' },
    mode: 'onSubmit',
  });

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header />
        <OnboardingLayout.Body constrained={false} scrollable={false}>
          <OnboardingLayout.ConstrainedContent>
            <YStack gap="$3">
              <YStack gap="$2" mb="$5">
                <SizableText size="$heading2xl">Select your email</SizableText>
                <SizableText size="$bodyLg" color="$textSubdued">
                  Add a wallet with Google, Apple, or enter your email
                </SizableText>
              </YStack>
              <OptionItem
                icon="GoogleIllus"
                title="Google"
                onPress={() => {
                  // TODO: Handle Google login
                }}
              />
              <OptionItem
                icon="AppleBrand"
                title="Apple"
                onPress={() => {
                  // TODO: Handle Apple login
                }}
              />
              <XStack alignItems="center" gap="$3">
                <Divider borderColor="$neutral3" />
                <SizableText
                  size="$bodySm"
                  color="$textSubdued"
                  textTransform="uppercase"
                >
                  Or
                </SizableText>
                <Divider borderColor="$neutral3" />
              </XStack>
              <Form form={form}>
                <Form.Field name="email">
                  <Input
                    // autoFocus={!platformEnv.isNative}
                    placeholder="your@email.com"
                    size="large"
                    leftIconName="EmailOutline"
                    autoCapitalize="none"
                    onChangeText={(text) => text?.trim() ?? text}
                    addOns={[
                      {
                        label: 'Submit',
                        onPress: () => {
                          // TODO: Handle email submit
                        },
                      },
                    ]}
                  />
                </Form.Field>
              </Form>
            </YStack>
          </OnboardingLayout.ConstrainedContent>
        </OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}

export { OneKeyIDLoginPage as default };
