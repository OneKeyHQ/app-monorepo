/* eslint-disable spellcheck/spell-checker */
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Form,
  Icon,
  Input,
  SizableText,
  XStack,
  YStack,
  useForm,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import type { IOneKeyIDLoginDialogVariant } from './OneKeyIDLoginDialog';

export interface IOneKeyIDLoginContentProps {
  variant?: IOneKeyIDLoginDialogVariant;
  isReady: boolean;
  onEmailSubmit: (email: string) => void;
}

export function OneKeyIDLoginContent({
  variant = 'default',
  isReady,
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

  const isKeylessWallet = variant === 'keylessWallet';

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
            placeholder="your@email.com"
            size="large"
            leftIconName="EmailOutline"
            autoCapitalize="none"
            onChangeText={(text) => text?.trim() ?? text}
            onSubmitEditing={() => handleSubmit()}
            addOns={[
              {
                label: 'Submit',
                loading: !isReady,
                onPress: handleSubmit,
              },
            ]}
          />
        </Form.Field>
      </Form>
      {isKeylessWallet ? (
        <>
          <SizableText mt="$2.5" size="$bodySm" color="$textSubdued">
            OneKey keyless wallet offers unique and powerful security. It uses
            advanced Shamir key-sharding technology to split your key into three
            parts, so there's no need to write down a seed phrase — your account
            can always be securely recovered.
          </SizableText>
          <XStack>
            <SizableText
              size="$bodySm"
              color="$textInteractive"
              textDecorationLine="underline"
              cursor="pointer"
              hoverStyle={{ opacity: 0.8 }}
              pressStyle={{ opacity: 0.6 }}
              onPress={() => {
                openUrlExternal('https://help.onekey.so/hc/articles/');
              }}
            >
              {intl.formatMessage({ id: ETranslations.global_learn_more })} ↗
            </SizableText>
          </XStack>
        </>
      ) : (
        <SizableText mt="$2.5" size="$bodySm" color="$textSubdued">
          OneKey ID is all you need to access all OneKey services and earn
          referral rewards.
        </SizableText>
      )}
    </YStack>
  );
}
