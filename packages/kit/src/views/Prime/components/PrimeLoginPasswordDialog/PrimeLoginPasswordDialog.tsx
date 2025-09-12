import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';
import { StatusBar } from 'react-native';
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
  useKeyboardEvent,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IPrimeLoginDialogAtomPasswordData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function PasswordStrengthBar({ score }: { score: number }) {
  const intl = useIntl();
  const getStrengthConfig = () => {
    switch (score) {
      case 2:
        return {
          width: '40%',
          color: '$bgCriticalStrong',
          text: intl.formatMessage({
            id: ETranslations.prime_password_level_weak,
          }),
        };
      case 3:
        return {
          width: '70%',
          color: '$bgInfoStrong',
          text: intl.formatMessage({
            id: ETranslations.prime_password_level_good,
          }),
        };
      case 4:
        return {
          width: '100%',
          color: '$bgSuccessStrong',
          text: intl.formatMessage({
            id: ETranslations.prime_password_level_strong,
          }),
        };
      case 0:
      case 1:
      default:
        return {
          width: '20%',
          color: '$bgCriticalStrong',
          text: intl.formatMessage({
            id: ETranslations.prime_password_level_weak,
          }),
        };
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
  richTextDescription,
}: {
  data: IPrimeLoginDialogAtomPasswordData | undefined;
  promiseId: number;
  richTextDescription?: string;
}) {
  const intl = useIntl();

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

        if (
          data?.isVerifyMasterPassword &&
          data?.serverUserInfo &&
          !data?.isRegister
        ) {
          await backgroundApiProxy.serviceMasterPassword.verifyServerMasterPasswordByServerUserInfo(
            {
              serverUserInfo: data.serverUserInfo,
              masterPassword: encodedPassword,
            },
          );
        }

        await backgroundApiProxy.servicePrime.resolvePrimeLoginPasswordDialog({
          promiseId,
          password: encodedPassword,
        });
      } catch (error) {
        options?.preventClose?.();
        throw error;
      }
    },
    [
      form,
      data?.isVerifyMasterPassword,
      data?.serverUserInfo,
      data?.isRegister,
      promiseId,
    ],
  );

  // OK-42373
  // Hide status bar when keyboard is shown
  useKeyboardEvent({
    keyboardWillShow: () => {
      StatusBar.setHidden(true);
    },
    keyboardWillHide: () => {
      StatusBar.setHidden(false);
    },
  });
  useEffect(
    () => () => {
      StatusBar.setHidden(false);
    },
    [],
  );

  return (
    <Stack>
      {richTextDescription ? (
        <RichSizeableText
          size="$bodyLg"
          mt="$1.5"
          pb="$4"
          linkList={{
            email: {
              url: undefined,
              textDecorationLine: 'underline',
              color: '$textDefault',
            },
          }}
        >
          {richTextDescription}
        </RichSizeableText>
      ) : null}
      <Stack>
        <YStack gap="$4">
          <Form form={form}>
            {data?.isChangeMasterPassword && data?.email ? (
              <SizableText color="$textSubdued" size="$bodyMd">
                {intl.formatMessage(
                  {
                    id: ETranslations.prime_new_password_description,
                  },
                  {
                    email: data?.email,
                  },
                )}
              </SizableText>
            ) : null}
            <Form.Field
              name="password"
              label={intl.formatMessage({
                id: data?.isChangeMasterPassword
                  ? ETranslations.prime_new_password
                  : ETranslations.prime_password,
              })}
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
                      {intl.formatMessage({
                        id: ETranslations.prime_forget_password,
                      })}
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
                placeholder={intl.formatMessage({
                  id: data?.isRegister
                    ? ETranslations.prime_strong_password
                    : ETranslations.prime_password,
                })}
                onSubmitEditing={() => {
                  void submit();
                }}
              />
            </Form.Field>
            {isRegister ? (
              <Form.Field
                name="confirmPassword"
                label={intl.formatMessage({
                  id: ETranslations.auth_confirm_password_form_label,
                })}
                rules={{
                  validate: isRegister
                    ? async (value) => {
                        if (form.getValues().password !== value) {
                          return intl.formatMessage({
                            id: ETranslations.prime_error_passcode_not_match,
                          });
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
                  placeholder={intl.formatMessage({
                    id: ETranslations.auth_confirm_password_form_placeholder,
                  })}
                  onSubmitEditing={() => {
                    void submit();
                  }}
                />
              </Form.Field>
            ) : null}

            {isRegister
              ? (() => {
                  const labelProps = {
                    variant: '$bodyMd',
                  };
                  const containerProps = {
                    py: '$1',
                  };
                  return (
                    <Stack>
                      <Checkbox
                        label={intl.formatMessage({
                          id: ETranslations.prime_strong_password_desc,
                        })}
                        labelProps={labelProps}
                        containerProps={containerProps}
                        value={passwordVerifyState.minLength}
                      />
                      <Checkbox
                        label={intl.formatMessage({
                          id: ETranslations.prime_password_number,
                        })}
                        labelProps={labelProps}
                        containerProps={containerProps}
                        value={passwordVerifyState.minNumberCharacter}
                      />
                      <Checkbox
                        label={intl.formatMessage({
                          id: ETranslations.prime_password_letter,
                        })}
                        labelProps={labelProps}
                        containerProps={containerProps}
                        value={passwordVerifyState.minLetterCharacter}
                      />
                      <Checkbox
                        label={intl.formatMessage({
                          id: ETranslations.prime_password_special_characters,
                        })}
                        labelProps={labelProps}
                        containerProps={containerProps}
                        value={passwordVerifyState.minSpecialCharacter}
                      />
                      <PasswordStrengthBar score={passwordVerifyState.score} />
                    </Stack>
                  );
                })()
              : null}
          </Form>
        </YStack>
      </Stack>
      <Dialog.Footer
        showCancelButton={false}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_continue,
        })}
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
