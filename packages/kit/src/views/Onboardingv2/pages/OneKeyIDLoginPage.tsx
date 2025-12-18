import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';

import type { IIconProps, IKeyOfIcons } from '@onekeyhq/components';
import {
  AnimatePresence,
  Button,
  Divider,
  Form,
  Icon,
  Input,
  OTPInput,
  Page,
  SizableText,
  XStack,
  YStack,
  useForm,
} from '@onekeyhq/components';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import {
  EOnboardingPagesV2,
  EOneKeyIDLoginView,
} from '@onekeyhq/shared/src/routes';

import { ListItem } from '../../../components/ListItem';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { OnboardingLayout } from '../components/OnboardingLayout';

import type { RouteProp } from '@react-navigation/core';

function OptionItem({
  icon,
  iconProps,
  title,
  onPress,
}: {
  icon: IKeyOfIcons;
  iconProps?: IIconProps;
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
      borderColor="$transparent"
      bg="$bgStrong"
      hoverStyle={{
        bg: '$bgStrongHover',
      }}
      pressStyle={{
        bg: '$bgStrongActive',
      }}
      // $platform-web={{
      //   boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      // }}
      userSelect="none"
      onPress={onPress}
    >
      <Icon name={icon} size="$5" {...iconProps} />
      <ListItem.Text flex={1} primary={title} />
    </ListItem>
  );
}

function LoginView({
  onEmailSubmit,
}: {
  onEmailSubmit: (email: string) => void;
}) {
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

  return (
    <YStack gap="$3">
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
        iconProps={{
          color: '$iconActive',
          y: -1,
        }}
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
    </YStack>
  );
}

function VerifyView({
  email,
  onConfirmSuccess,
}: {
  email: string;
  onConfirmSuccess: () => void;
}) {
  const [verificationCode, setVerificationCode] = useState('');
  const [status, setStatus] = useState<'initial' | 'error'>('initial');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const handleConfirm = useCallback(async () => {
    if (isSubmitting || verificationCode.length !== 6) {
      return;
    }
    setIsSubmitting(true);
    try {
      // TODO: Implement OTP verification logic
      console.log('Verifying code:', verificationCode, 'for email:', email);
      onConfirmSuccess();
    } catch {
      setStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, verificationCode, email, onConfirmSuccess]);

  const handleResend = useCallback(() => {
    // TODO: Implement resend logic
    setCountdown(60);
    setStatus('initial');
    setVerificationCode('');
    console.log('Resending code to:', email);
  }, [email]);

  // 1-0
  // 2-0.5
  // 3-1
  // 4-2
  // 5-5
  // 6-5
  // 7-forever
  //

  return (
    <YStack
      gap="$5"
      animation="quick"
      enterStyle={{
        opacity: 0,
        x: 20,
        filter: 'blur(4px)',
      }}
    >
      <YStack gap="$2">
        <OTPInput
          autoFocus
          status={status === 'error' ? 'error' : 'normal'}
          numberOfDigits={6}
          value={verificationCode}
          onTextChange={(value) => {
            setVerificationCode(value);
            setStatus('initial');
          }}
        />
        {status === 'error' ? (
          <SizableText size="$bodyMd" color="$textCritical">
            Invalid verification code
          </SizableText>
        ) : null}
      </YStack>

      <Button
        variant="primary"
        size="large"
        loading={isSubmitting}
        onPress={handleConfirm}
      >
        Confirm
      </Button>

      <Button
        alignSelf="center"
        size="small"
        variant="tertiary"
        disabled={countdown > 0}
        onPress={handleResend}
      >
        {countdown > 0 ? `Resend (${countdown}s)` : 'Resend'}
      </Button>
    </YStack>
  );
}

function OneKeyIDLoginPage() {
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<IOnboardingParamListV2, EOnboardingPagesV2.OneKeyIDLogin>
    >();
  const { initialView, email: initialEmail } = route.params ?? {};

  const [view, setView] = useState<EOneKeyIDLoginView>(
    initialView ?? EOneKeyIDLoginView.Login,
  );
  const [email, setEmail] = useState(initialEmail ?? '');

  const handleEmailSubmit = useCallback((submittedEmail: string) => {
    setEmail(submittedEmail);
    setView(EOneKeyIDLoginView.Verify);
    // TODO: Send verification code to email
  }, []);

  const handleConfirmSuccess = useCallback(() => {
    navigation.push(EOnboardingPagesV2.CreatePin);
  }, [navigation]);

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header />
        <OnboardingLayout.Body constrained={false} scrollable={false}>
          <OnboardingLayout.ConstrainedContent gap="$10">
            <YStack gap="$2">
              <SizableText size="$heading2xl">
                {view === EOneKeyIDLoginView.Login
                  ? 'Select your email'
                  : 'Enter verification code'}
              </SizableText>
              <SizableText size="$bodyLg" color="$textSubdued">
                {view === EOneKeyIDLoginView.Login
                  ? 'Add a wallet with Google, Apple, or enter your email'
                  : 'A verification code was sent to your email'}
              </SizableText>
            </YStack>
            <AnimatePresence exitBeforeEnter initial={false}>
              {view === EOneKeyIDLoginView.Login ? (
                <LoginView key="login" onEmailSubmit={handleEmailSubmit} />
              ) : (
                <VerifyView
                  key="verify"
                  email={email}
                  onConfirmSuccess={handleConfirmSuccess}
                />
              )}
            </AnimatePresence>
          </OnboardingLayout.ConstrainedContent>
        </OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}

export { OneKeyIDLoginPage as default };
