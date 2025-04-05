import { useCallback, useMemo, useState } from 'react';

import zxcvbn from 'zxcvbn';

import {
  Button,
  Checkbox,
  Dialog,
  Form,
  Input,
  RichSizeableText,
  SizableText,
  Stack,
  XStack,
  YStack,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IPrimeLoginDialogAtomPasswordData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

function PasswordStrengthBar({ score }: { score: number }) {
  const getStrengthConfig = () => {
    switch (score) {
      case 2:
        return { width: '40%', color: '$bgCriticalStrong', text: 'Weak' };
      case 3:
        return { width: '70%', color: '$bgInfoStrong', text: 'Good' };
      case 4:
        return { width: '100%', color: '$bgSuccessStrong', text: 'Strong' };
      case 0:
      case 1:
      default:
        return { width: '20%', color: '$bgCriticalStrong', text: 'Weak' };
    }
  };

  const { width, color, text } = getStrengthConfig();

  return (
    <YStack gap="$2" py="$2">
      <XStack h="$1" bg="$bgSubdued" borderRadius="$full">
        <Stack
          bg={color}
          h="$1"
          w={width}
          borderRadius="$full"
          // animate={{ type: 'spring' }}
        />
      </XStack>
      <SizableText color={color} size="$bodyMd">
        {text}
      </SizableText>
    </YStack>
  );
}

export function PrimeLoginPasswordDialog({
  data,
  promiseId,
}: {
  data: IPrimeLoginDialogAtomPasswordData | undefined;
  promiseId: number;
}) {
  const [confirmPassword, setConfirmPassword] = useState('');

  const isRegister = data?.isRegister;
  const email = data?.email || '';

  // console.log({ isRegister, email });

  const form = useForm<{ password: string; confirmPassword: string }>({
    // mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: { password: '', confirmPassword: '' },
  });

  const [passwordVerifyState, setPasswordVerifyState] = useState<{
    minLength: boolean;
    minNumberCharacter: boolean;
    minLetterCharacter: boolean;
    minSpecialCharacter: boolean;
    score: number;
  }>({
    minLength: false,
    minNumberCharacter: false,
    minLetterCharacter: false,
    minSpecialCharacter: false,
    score: 0, // 0-4
  });

  const isValidPassword = useCallback(
    (password: string) => {
      let minLength = true;
      let minNumberCharacter = true;
      let minLetterCharacter = true;
      let minSpecialCharacter = true;
      let score = 0;

      const zxcvbnUserInputs = [email.split('@')?.[0]].filter(Boolean);
      // const zxcvbnUserInputs: string[] = [];
      const result = zxcvbn(password, zxcvbnUserInputs);
      score = result.score;

      if (password.length < 12) {
        minLength = false;
      }
      if (!/\d/.test(password)) {
        minNumberCharacter = false;
      }
      if (!/[a-zA-Z]/.test(password)) {
        minLetterCharacter = false;
      }
      // eslint-disable-next-line no-useless-escape
      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]/.test(password)) {
        minSpecialCharacter = false;
      }

      setPasswordVerifyState({
        minLength,
        minNumberCharacter,
        minLetterCharacter,
        minSpecialCharacter,
        score,
      });

      return (
        minLength &&
        minNumberCharacter &&
        minLetterCharacter &&
        minSpecialCharacter &&
        score >= 3
      );
    },
    [email],
  );

  const submit = useCallback(
    async (options: { preventClose?: () => void } = {}) => {
      await form.trigger();
      if (!form.formState.isValid) {
        options?.preventClose?.();
        return;
      }
      const formData = form.getValues();
      try {
        const encodedPassword =
          await backgroundApiProxy.servicePassword.encodeSensitiveText({
            text: formData.password,
          });
        await backgroundApiProxy.serviceMasterPassword.ensurePrimeLoginValidPassword(
          encodedPassword,
        );
        await backgroundApiProxy.servicePrime.resolvePrimeLoginPasswordDialog({
          promiseId,
          password: encodedPassword,
        });
      } catch (error) {
        options?.preventClose?.();
        throw error;
      }
    },
    [form, promiseId],
  );

  const states = useMemo(() => {
    let title = 'Welcome back';
    let description = `Manage your OneKey ID <email>${email}</email>`;
    if (isRegister) {
      title = 'Setup OneKey ID Master Password';
      description = 'Please enter a password to secure your sync data';
      // description = `<email>${email}</email> is not registered yet, we will create a new account for you.`;
    }
    return {
      title,
      description,
    };
  }, [email, isRegister]);

  return (
    <Stack>
      <Dialog.Title>{states.title}</Dialog.Title>
      <RichSizeableText
        size="$bodyLg"
        mt="$1.5"
        linkList={{
          email: {
            url: undefined,
            textDecorationLine: 'underline',
            color: '$textDefault',
          },
        }}
      >
        {states.description}
      </RichSizeableText>
      <Stack pt="$4">
        <YStack gap="$4">
          <Form form={form}>
            <Form.Field
              name="password"
              label="Password"
              labelAddon={
                !isRegister ? (
                  <XStack>
                    <Button
                      size="small"
                      variant="tertiary"
                      onPress={async () => {
                        await backgroundApiProxy.serviceMasterPassword.startForgetPassword(
                          {
                            passwordDialogPromiseId: promiseId,
                            email,
                          },
                        );
                      }}
                    >
                      Forget password?
                    </Button>
                  </XStack>
                ) : null
              }
              rules={{
                validate: isRegister
                  ? (value) => {
                      if (!isValidPassword(value)) {
                        return false;
                      }
                      return true;
                    }
                  : (value) => {
                      if (!value) {
                        return false;
                      }
                      return true;
                    },
                onChange: () => {
                  void form.trigger('password');
                },
              }}
            >
              <Input
                autoFocus
                allowSecureTextEye
                placeholder="Password"
                onSubmitEditing={() => {
                  void submit();
                }}
              />
            </Form.Field>
            {isRegister ? (
              <Form.Field
                name="confirmPassword"
                label="Confirm Password"
                rules={{
                  validate: isRegister
                    ? async (value) => {
                        if (form.getValues().password !== value) {
                          return 'Password does not match';
                        }
                        return true;
                      }
                    : (value) => {
                        if (!value) {
                          return false;
                        }
                        return true;
                      },
                  onChange: () => {
                    void form.trigger('confirmPassword');
                  },
                }}
              >
                <Input
                  allowSecureTextEye
                  placeholder="Confirm Password"
                  onSubmitEditing={() => {
                    void submit();
                  }}
                />
              </Form.Field>
            ) : null}

            {isRegister ? (
              <Stack>
                <Checkbox
                  label="At least 12 characters"
                  value={passwordVerifyState.minLength}
                />
                <Checkbox
                  label="At least 1 number"
                  value={passwordVerifyState.minNumberCharacter}
                />
                <Checkbox
                  label="At least 1 letter"
                  value={passwordVerifyState.minLetterCharacter}
                />
                <Checkbox
                  label="At least 1 special character"
                  value={passwordVerifyState.minSpecialCharacter}
                />
                <PasswordStrengthBar score={passwordVerifyState.score} />
              </Stack>
            ) : null}
          </Form>
        </YStack>
      </Stack>
      <Dialog.Footer
        showCancelButton={false}
        onConfirmText="Continue"
        confirmButtonProps={{
          disabled: !form.formState.isValid,
        }}
        onConfirm={async ({ preventClose }) => {
          await submit({ preventClose });
        }}
      />
    </Stack>
  );
}
