/* eslint-disable spellcheck/spell-checker */
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Form,
  Icon,
  Input,
  SizableText,
  YStack,
  useForm,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

export interface IOneKeyIDLoginContentProps {
  onEmailSubmit: (email: string) => void;
}

export function OneKeyIDLoginContent({
  onEmailSubmit,
}: IOneKeyIDLoginContentProps) {
  const intl = useIntl();
  const form = useForm<{ email: string }>({
    defaultValues: { email: '' },
    mode: 'onSubmit',
  });

  const handleSubmit = useCallback(async () => {
    const isValid = await form.trigger('email');
    if (isValid) {
      const email = form.getValues('email');
      onEmailSubmit(email);
    } else {
      setTimeout(() => {
        form.setFocus('email');
      }, 100);
    }
  }, [form, onEmailSubmit]);

  const handleGoogleLogin = useCallback(() => {
    // TODO: Implement Google OAuth login with Privy
    console.log('Google login clicked - OAuth integration pending');
  }, []);

  const handleAppleLogin = useCallback(() => {
    // TODO: Implement Apple OAuth login with Privy
    console.log('Apple login clicked - OAuth integration pending');
  }, []);

  return (
    <YStack gap="$2.5">
      <ListItem
        py={10}
        m="$0"
        gap="$2"
        drillIn
        borderWidth={1}
        borderColor="$borderStrong"
        userSelect="none"
        onPress={handleGoogleLogin}
      >
        <Icon name="GoogleIllus" size="$5" />
        <ListItem.Text
          flex={1}
          primary="Google"
          primaryTextProps={{
            size: '$bodyLg',
          }}
        />
      </ListItem>
      <ListItem
        py={10}
        m="$0"
        gap="$2"
        drillIn
        borderWidth={1}
        borderColor="$borderStrong"
        userSelect="none"
        onPress={handleAppleLogin}
      >
        <Icon name="AppleBrand" size="$5" y={-1} color="$iconActive" />
        <ListItem.Text
          flex={1}
          primary="Apple"
          primaryTextProps={{
            size: '$bodyLg',
          }}
        />
      </ListItem>
      <Form form={form}>
        <Form.Field
          name="email"
          rules={{
            validate: (value) => {
              if (!value) {
                return intl.formatMessage({
                  id: ETranslations.prime_onekeyid_email_error,
                });
              }
              if (!stringUtils.isValidEmail(value)) {
                return intl.formatMessage({
                  id: ETranslations.prime_onekeyid_email_error,
                });
              }
              return true;
            },
            onChange: () => {
              form.clearErrors();
            },
          }}
        >
          <Input
            autoFocus={!platformEnv.isNative}
            blurOnSubmit={false}
            placeholder="your@email.com"
            size="large"
            leftIconName="EmailOutline"
            autoCapitalize="none"
            onChangeText={(text) => text?.trim() ?? text}
            onSubmitEditing={() => handleSubmit()}
            addOns={[
              {
                label: 'Submit',
                onPress: handleSubmit,
              },
            ]}
          />
        </Form.Field>
      </Form>
      <SizableText mt="$2.5" size="$bodySm" color="$textSubdued">
        OneKey ID is all you need to access all OneKey services and earn
        referral rewards.
      </SizableText>
    </YStack>
  );
}
