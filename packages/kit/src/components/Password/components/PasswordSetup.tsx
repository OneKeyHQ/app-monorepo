import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { Keyboard } from 'react-native';

import {
  Button,
  Dialog,
  Divider,
  Form,
  Heading,
  Input,
  Unspaced,
  useForm,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EPasswordMode } from '@onekeyhq/shared/types/password';

import {
  PassCodeRegex,
  PasswordRegex,
  getPasswordKeyboardType,
} from '../utils';

import PassCodeInput, {
  AUTO_FOCUS_DELAY_MS,
  PIN_CELL_COUNT,
} from './PassCodeInput';

export interface IPasswordSetupForm {
  password: string;
  confirmPassword: string;
  passwordMode: EPasswordMode;
  passCode: string;
  confirmPassCode: string;
}
interface IPasswordSetupProps {
  loading: boolean;
  passwordMode: EPasswordMode;
  onSetupPassword: (data: IPasswordSetupForm) => void;
  biologyAuthSwitchContainer?: React.ReactNode;
  confirmBtnText?: string;
}
const useHandleEnterKey = platformEnv.isNative
  ? () => {}
  : (onSubmitCallback: () => void) => {
      const handleKeyPress = useCallback(
        (event: KeyboardEvent) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onSubmitCallback();
          }
        },
        [onSubmitCallback],
      );

      useEffect(() => {
        globalThis.addEventListener('keypress', handleKeyPress);
        return () => {
          globalThis.removeEventListener('keypress', handleKeyPress);
        };
      }, [handleKeyPress]);
    };

const PasswordSetup = ({
  loading,
  passwordMode,
  onSetupPassword,
  confirmBtnText,
  biologyAuthSwitchContainer,
}: IPasswordSetupProps) => {
  const intl = useIntl();
  const [currentPasswordMode, setCurrentPasswordMode] = useState(passwordMode);
  const [passCodeConfirm, setPassCodeConfirm] = useState(false);
  useEffect(() => {
    setCurrentPasswordMode(passwordMode);
  }, [passwordMode]);
  const form = useForm<IPasswordSetupForm>({
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    defaultValues: {
      password: '',
      passCode: '',
      confirmPassword: '',
      confirmPassCode: '',
      passwordMode: currentPasswordMode,
    },
  });
  const [secureEntry, setSecureEntry] = useState(true);
  const [secureReentry, setSecureReentry] = useState(true);
  const [passCodeConfirmClear, setPassCodeConfirmClear] = useState(false);
  const passCodeFirstStep = useMemo(
    () => currentPasswordMode === EPasswordMode.PASSCODE && !passCodeConfirm,
    [currentPasswordMode, passCodeConfirm],
  );
  const confirmBtnTextMemo = useMemo(() => {
    if (passCodeFirstStep) {
      return intl.formatMessage({ id: ETranslations.global_next });
    }
    return (
      confirmBtnText ??
      intl.formatMessage({ id: ETranslations.auth_set_passcode })
    );
  }, [confirmBtnText, intl, passCodeFirstStep]);
  const onPassCodeNext = useCallback(() => {
    setPassCodeConfirm(true);
    setTimeout(() => {
      form.setFocus('confirmPassCode');
    }, 150);
  }, [form]);

  const clearPasscodeTimeOut = useCallback(() => {
    setPassCodeConfirmClear(false);
    setTimeout(() => {
      form.setValue('confirmPassCode', '');
      setPassCodeConfirmClear(true);
    }, 200);
  }, [form]);

  const handleSubmit = useCallback(() => {
    void form.handleSubmit(
      passCodeFirstStep ? onPassCodeNext : onSetupPassword,
    )();
  }, [form, passCodeFirstStep, onPassCodeNext, onSetupPassword]);

  useHandleEnterKey(handleSubmit);

  return (
    <>
      {currentPasswordMode === EPasswordMode.PASSCODE && passCodeConfirm ? (
        <Dialog.Header>
          <Dialog.Title>
            <Heading size="$headingXl" py="$px">
              {intl.formatMessage({
                id: ETranslations.auth_confirm_passcode_form_label,
              })}
            </Heading>
          </Dialog.Title>
        </Dialog.Header>
      ) : (
        <Dialog.Header>
          <Dialog.Title>
            <Heading size="$headingXl" py="$px">
              {intl.formatMessage({
                id: ETranslations.global_set_passcode,
              })}
            </Heading>
          </Dialog.Title>
        </Dialog.Header>
      )}
      <Form form={form}>
        {currentPasswordMode === EPasswordMode.PASSWORD ? (
          <>
            <Form.Field
              label={intl.formatMessage({
                id: ETranslations.auth_new_passcode_form_label,
              })}
              name="password"
              rules={{
                required: {
                  value: true,
                  message: intl.formatMessage({
                    id: ETranslations.auth_error_passcode_empty,
                  }),
                },
                minLength: {
                  value: 8,
                  message: intl.formatMessage(
                    { id: ETranslations.auth_error_passcode_too_short },
                    {
                      length: 8,
                    },
                  ),
                },
                maxLength: {
                  value: 128,
                  message: intl.formatMessage(
                    {
                      id: ETranslations.auth_error_passcode_too_long,
                    },
                    {
                      length: 128,
                    },
                  ),
                },
                validate: {
                  regexCheck: (v: string) =>
                    v.replace(PasswordRegex, '') === v
                      ? undefined
                      : intl.formatMessage({
                          id: ETranslations.global_hex_data_error,
                        }),
                },
                onChange: () => {
                  form.clearErrors();
                },
              }}
            >
              <Input
                size="large"
                $gtMd={{
                  size: 'medium',
                }}
                placeholder={intl.formatMessage({
                  id: ETranslations.auth_new_passcode_form_placeholder,
                })}
                disabled={loading}
                autoFocus
                autoFocusDelayMs={AUTO_FOCUS_DELAY_MS}
                keyboardType={getPasswordKeyboardType(!secureEntry)}
                onChangeText={(text) => text.replace(PasswordRegex, '')}
                secureTextEntry={secureEntry}
                addOns={[
                  {
                    iconName: secureEntry ? 'EyeOutline' : 'EyeOffOutline',
                    onPress: () => {
                      setSecureEntry(!secureEntry);
                    },
                    testID: `password-eye-${secureEntry ? 'off' : 'on'}`,
                  },
                ]}
                testID="password"
              />
            </Form.Field>
            <Form.Field
              label={intl.formatMessage({
                id: ETranslations.auth_confirm_passcode_form_label,
              })}
              name="confirmPassword"
              rules={{
                validate: {
                  equal: (v, values) => {
                    const state = form.getFieldState('password');
                    if (!state.error) {
                      return v !== values.password
                        ? intl.formatMessage({
                            id: ETranslations.auth_error_passcode_not_match,
                          })
                        : undefined;
                    }
                    return undefined;
                  },
                },
                onChange: () => {
                  form.clearErrors('confirmPassword');
                },
              }}
            >
              <Input
                size="large"
                $gtMd={{
                  size: 'medium',
                }}
                placeholder={intl.formatMessage({
                  id: ETranslations.auth_confirm_passcode_form_placeholder,
                })}
                disabled={loading}
                keyboardType={getPasswordKeyboardType(!secureReentry)}
                onChangeText={(text) => text.replace(PasswordRegex, '')}
                secureTextEntry={secureReentry}
                addOns={[
                  {
                    iconName: secureReentry ? 'EyeOutline' : 'EyeOffOutline',
                    onPress: () => {
                      setSecureReentry(!secureReentry);
                    },
                    testID: `confirm-password-eye-${
                      secureReentry ? 'off' : 'on'
                    }`,
                  },
                ]}
                testID="confirm-password"
              />
            </Form.Field>
          </>
        ) : (
          <>
            <Form.Field
              name="passCode"
              display={passCodeFirstStep ? 'flex' : 'none'}
              errorMessageAlign="center"
              rules={{
                validate: {
                  required: (v) =>
                    v
                      ? undefined
                      : intl.formatMessage({
                          id: ETranslations.auth_error_passcode_empty,
                        }),
                  minLength: (v: string) =>
                    v.length >= PIN_CELL_COUNT
                      ? undefined
                      : intl.formatMessage(
                          { id: ETranslations.auth_error_passcode_too_short },
                          {
                            length: PIN_CELL_COUNT,
                          },
                        ),
                  regexCheck: (v: string) =>
                    v.replace(PassCodeRegex, '') === v
                      ? undefined
                      : intl.formatMessage({
                          id: ETranslations.global_hex_data_error,
                        }),
                },
                onChange: () => {
                  form.clearErrors();
                },
              }}
            >
              <PassCodeInput
                onPinCodeChange={(pin) => {
                  form.setValue('passCode', pin);
                  form.clearErrors('passCode');
                }}
                editable
                autoFocus
                onComplete={form.handleSubmit(onPassCodeNext)}
                autoFocusDelayMs={AUTO_FOCUS_DELAY_MS}
                testId="pass-code"
              />
            </Form.Field>
            <Form.Field
              display={passCodeFirstStep ? 'none' : 'flex'}
              name="confirmPassCode"
              errorMessageAlign="center"
              rules={{
                validate: {
                  equal: (v, values) => {
                    if (passCodeFirstStep) {
                      return undefined;
                    }
                    const state = form.getFieldState('passCode');
                    if (!state.error) {
                      if (v !== values.passCode) {
                        clearPasscodeTimeOut();
                      }
                      return v !== values.passCode
                        ? intl.formatMessage({
                            id: ETranslations.auth_error_passcode_not_match,
                          })
                        : undefined;
                    }
                    return undefined;
                  },
                },
                onChange: () => {
                  form.clearErrors('confirmPassCode');
                },
              }}
            >
              <PassCodeInput
                onPinCodeChange={(pin) => {
                  form.setValue('confirmPassCode', pin);
                  form.clearErrors('confirmPassCode');
                }}
                editable
                autoFocus={passCodeConfirm}
                clearCodeAndFocus={passCodeConfirmClear}
                onComplete={form.handleSubmit(onSetupPassword)}
                autoFocusDelayMs={AUTO_FOCUS_DELAY_MS}
                testId="confirm-pass-code"
              />
              <Divider />
            </Form.Field>
          </>
        )}
        {!passCodeFirstStep ? (
          <Unspaced>{biologyAuthSwitchContainer}</Unspaced>
        ) : null}
        {currentPasswordMode === EPasswordMode.PASSWORD ? (
          <Button
            size="large"
            $gtMd={
              {
                size: 'medium',
              } as any
            }
            variant="primary"
            loading={loading}
            onPress={handleSubmit}
            testID="set-password"
          >
            {confirmBtnTextMemo}
          </Button>
        ) : null}
        {platformEnv.isNative &&
        (passCodeFirstStep ||
          currentPasswordMode === EPasswordMode.PASSWORD) ? (
          <Button
            size="small"
            variant="tertiary"
            onPress={async () => {
              form.reset();
              if (platformEnv.isNativeAndroid) {
                Keyboard.dismiss();
                await timerUtils.wait(380);
              }
              const newPasswordMode =
                currentPasswordMode === EPasswordMode.PASSWORD
                  ? EPasswordMode.PASSCODE
                  : EPasswordMode.PASSWORD;
              setCurrentPasswordMode(newPasswordMode);
              form.setValue('passwordMode', newPasswordMode);
            }}
          >
            {currentPasswordMode === EPasswordMode.PASSWORD
              ? intl.formatMessage({ id: ETranslations.auth_Numeric_Passcode })
              : intl.formatMessage({
                  id: ETranslations.auth_alphanumeric_passcode,
                })}
          </Button>
        ) : null}
      </Form>
    </>
  );
};

export default memo(PasswordSetup);
