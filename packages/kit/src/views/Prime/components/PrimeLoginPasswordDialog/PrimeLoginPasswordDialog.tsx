import { useCallback, useMemo, useState } from 'react';

import {
  Button,
  Checkbox,
  Dialog,
  Form,
  Input,
  RichSizeableText,
  Stack,
  XStack,
  YStack,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IPrimeLoginDialogAtomPasswordData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

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
  }>({
    minLength: false,
    minNumberCharacter: false,
    minLetterCharacter: false,
    minSpecialCharacter: false,
  });

  const isValidPassword = useCallback((password: string) => {
    let minLength = true;
    let minNumberCharacter = true;
    let minLetterCharacter = true;
    let minSpecialCharacter = true;

    if (password.length < 8) {
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
    });

    return (
      minLength &&
      minNumberCharacter &&
      minLetterCharacter &&
      minSpecialCharacter
    );
  }, []);

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
        await backgroundApiProxy.servicePrime.ensurePrimeLoginValidPassword(
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
      title = 'Sign up OneKey ID';
      description = `<email>${email}</email> is not registered yet, we will create a new account for you.`;
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
                        await backgroundApiProxy.servicePrime.startForgetPassword(
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
            {/* {isRegister ? (
              <Input
                secureTextEntry
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            ) : null} */}

            {isRegister ? (
              <Stack>
                <Checkbox
                  label="At least 8 characters"
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
