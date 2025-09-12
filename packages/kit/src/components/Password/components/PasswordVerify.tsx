import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons, IPropsWithTestId } from '@onekeyhq/components';
import {
  Dialog,
  Form,
  IconButton,
  Input,
  Portal,
  SizableText,
  XStack,
  YStack,
  onVisibilityStateChange,
  useForm,
} from '@onekeyhq/components';
import { usePasswordAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import biologyAuth from '@onekeyhq/shared/src/biologyAuth';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { checkBiometricAuthChanged } from '@onekeyhq/shared/src/modules3rdParty/check-biometric-auth-changed';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EPasswordMode,
  EPasswordVerifyStatus,
} from '@onekeyhq/shared/types/password';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useBiometricAuthInfo } from '../../../hooks/useBiometricAuthInfo';
import { useHandleAppStateActive } from '../../../hooks/useHandleAppStateActive';
import { inAppStateLockStyle } from '../../../views/Setting/hooks';
import { getPasswordKeyboardType } from '../utils';

import PassCodeInput from './PassCodeInput';

import type { AuthenticationType } from 'expo-local-authentication';

interface IPasswordVerifyProps {
  authType: AuthenticationType[];
  isEnable: boolean;
  disableInput?: boolean;
  passwordMode: EPasswordMode;
  onPasswordChange: (e: any) => void;
  onBiologyAuth: () => void;
  onInputPasswordAuth: (data: IPasswordVerifyForm) => void;
  status: {
    value: EPasswordVerifyStatus;
    message?: string;
  };
  alertText?: string;
  confirmBtnDisabled?: boolean;
}

export interface IPasswordVerifyForm {
  password: string;
  passCode: string;
}

const PasswordVerify = ({
  isEnable,
  alertText,
  confirmBtnDisabled,
  disableInput,
  status,
  passwordMode,
  onBiologyAuth,
  onPasswordChange,
  onInputPasswordAuth,
}: IPasswordVerifyProps) => {
  const intl = useIntl();
  const form = useForm<IPasswordVerifyForm>({
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    defaultValues: { password: '', passCode: '' },
  });

  const isEnableRef = useRef(isEnable);
  if (isEnableRef.current !== isEnable) {
    isEnableRef.current = isEnable;
  }

  const disableInputRef = useRef(disableInput);
  if (disableInputRef.current !== disableInput) {
    disableInputRef.current = disableInput;
  }
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      if (!isEnableRef.current && !disableInputRef.current) {
        form.setFocus(
          passwordMode === EPasswordMode.PASSWORD ? 'password' : 'passCode',
        );
      }
    }, 200);
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [form, passwordMode]);
  const [secureEntry, setSecureEntry] = useState(true);
  const lastTime = useRef(0);
  const passwordInput = form.watch(
    passwordMode === EPasswordMode.PASSWORD ? 'password' : 'passCode',
  );
  const [{ manualLocking }] = usePasswordAtom();
  const { icon: biologyAuthIconName, title: authTitle } =
    useBiometricAuthInfo();

  const rightActions = useMemo(() => {
    const actions: IPropsWithTestId<{
      iconName?: IKeyOfIcons;
      onPress?: () => void;
      loading?: boolean;
      disabled?: boolean;
    }>[] = [];
    if (isEnable && !passwordInput) {
      actions.push({
        iconName: biologyAuthIconName,
        onPress: onBiologyAuth,
        loading: status.value === EPasswordVerifyStatus.VERIFYING,
      });
    } else {
      actions.push({
        iconName: secureEntry ? 'EyeOutline' : 'EyeOffOutline',
        onPress: () => {
          setSecureEntry(!secureEntry);
        },
      });
      actions.push({
        iconName: 'ArrowRightOutline',
        onPress: form.handleSubmit(onInputPasswordAuth),
        loading: status.value === EPasswordVerifyStatus.VERIFYING,
        disabled: confirmBtnDisabled,
        testID: 'verifying-password',
      });
    }

    return actions;
  }, [
    isEnable,
    passwordInput,
    biologyAuthIconName,
    onBiologyAuth,
    status.value,
    secureEntry,
    form,
    onInputPasswordAuth,
    confirmBtnDisabled,
  ]);
  const [passCodeClear, setPassCodeClear] = useState(false);
  useEffect(() => {
    const fieldName =
      passwordMode === EPasswordMode.PASSWORD ? 'password' : 'passCode';
    if (status.value === EPasswordVerifyStatus.ERROR) {
      form.setError(fieldName, { message: status.message });
      if (passwordMode === EPasswordMode.PASSCODE) {
        setPassCodeClear(true);
      }
      if (!disableInputRef.current) {
        setTimeout(() => {
          form.setFocus(fieldName);
        }, 150);
      }
    } else {
      form.clearErrors(fieldName);
    }
  }, [form, passwordMode, status]);

  const checkAuthChanged = useCallback(async () => {
    const isSupport = await biologyAuth.isSupportBiologyAuth();
    if (!isSupport) {
      return false;
    }
    try {
      const changed = await checkBiometricAuthChanged();
      if (changed) {
        await backgroundApiProxy.servicePassword.setBiologyAuthEnable(false);
        setTimeout(() => {
          Dialog.confirm({
            icon: 'ErrorOutline',
            tone: 'warning',
            ...inAppStateLockStyle,
            isOverTopAllViews: true,
            portalContainer: Portal.Constant.APP_STATE_LOCK_CONTAINER_OVERLAY,
            title: intl.formatMessage(
              {
                id: ETranslations.global_biometric_disabled,
              },
              {
                authentication: authTitle,
              },
            ),
            description: intl.formatMessage(
              {
                id: ETranslations.global_biometric_disabled_desc,
              },
              {
                authentication: authTitle,
              },
            ),
            onConfirmText: intl.formatMessage({
              id: ETranslations.global_i_got_it,
            }),
          });
        }, 50);
      }
      return changed;
    } catch (error) {
      console.error(error);
    }
    return false;
  }, [authTitle, intl]);

  useLayoutEffect(() => {
    void (async () => {
      const changed =
        platformEnv.isNativeIOS || platformEnv.isDesktopMac
          ? await checkAuthChanged()
          : false;
      if (changed) {
        return;
      }
      if (
        isEnable &&
        !passwordInput &&
        status.value === EPasswordVerifyStatus.DEFAULT &&
        !manualLocking
      ) {
        void onBiologyAuth();
      }
    })();

    if (platformEnv.isNativeIOS || platformEnv.isDesktopMac) {
      const handleVisibilityStateChange = (visible: boolean) => {
        if (visible) {
          void checkAuthChanged();
        }
      };
      const removeSubscription = onVisibilityStateChange(
        handleVisibilityStateChange,
      );
      return removeSubscription;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnable, manualLocking]);

  // Perform biology verification upon returning to the backend after a 1-second interval.
  const onActive = useCallback(() => {
    const now = Date.now();
    if (now - lastTime.current > 1000) {
      lastTime.current = now;
      if (
        isEnable &&
        !passwordInput &&
        status.value === EPasswordVerifyStatus.DEFAULT &&
        !manualLocking
      ) {
        void onBiologyAuth();
      }
    }
  }, [isEnable, passwordInput, status.value, manualLocking, onBiologyAuth]);

  useHandleAppStateActive(isEnable ? onActive : undefined);

  const onPassCodeComplete = useCallback(() => {
    setTimeout(() => {
      void form.handleSubmit(onInputPasswordAuth)();
    });
  }, [form, onInputPasswordAuth]);

  return (
    <Form form={form}>
      {passwordMode === EPasswordMode.PASSWORD ? (
        <>
          <Form.Field
            name="password"
            rules={{
              required: {
                value: true,
                message: intl.formatMessage({
                  id: ETranslations.auth_error_passcode_incorrect,
                }),
              },
              onChange: onPasswordChange,
            }}
          >
            <Input
              selectTextOnFocus
              size="large"
              editable={Boolean(
                status.value !== EPasswordVerifyStatus.VERIFYING &&
                  !disableInput,
              )}
              placeholder={intl.formatMessage({
                id: ETranslations.auth_enter_your_passcode,
              })}
              flex={1}
              // onChangeText={(text) => text.replace(PasswordRegex, '')}
              onChangeText={(text) => text}
              keyboardType={getPasswordKeyboardType(!secureEntry)}
              secureTextEntry={secureEntry}
              // fix Keyboard Flickering on TextInput with secureTextEntry #39411
              // https://github.com/facebook/react-native/issues/39411
              textContentType="oneTimeCode"
              onSubmitEditing={form.handleSubmit(onInputPasswordAuth)}
              addOns={rightActions}
              testID="password-input"
            />
          </Form.Field>
          {alertText ? (
            <XStack alignSelf="center" w="$45" h="$10" borderRadius="$2.5">
              <SizableText size="$bodyMd" color="$textOnBrightColor">
                {alertText}
              </SizableText>
            </XStack>
          ) : null}
        </>
      ) : (
        <>
          <Form.Field
            name="passCode"
            errorMessageAlign="center"
            rules={{
              validate: {
                required: (v) =>
                  v
                    ? undefined
                    : intl.formatMessage({
                        id: ETranslations.auth_error_passcode_empty,
                      }),
              },
              onChange: onPasswordChange,
            }}
          >
            <PassCodeInput
              onPinCodeChange={(pin) => {
                form.setValue('passCode', pin);
                form.clearErrors('passCode');
                setPassCodeClear(false);
              }}
              editable={Boolean(
                status.value !== EPasswordVerifyStatus.VERIFYING &&
                  !disableInput,
              )}
              onComplete={onPassCodeComplete}
              clearCode={passCodeClear}
              disabledComplete={confirmBtnDisabled}
              testId="pass-code-input"
            />
          </Form.Field>
          {alertText ? (
            <XStack alignSelf="center" w="$45" h="$10" borderRadius="$2.5">
              <SizableText size="$bodyMd" color="$textDisabled">
                {alertText}
              </SizableText>
            </XStack>
          ) : null}
          {isEnable ? (
            <YStack alignSelf="center" pt="$6" scale={1.5}>
              <IconButton
                size="large"
                variant="tertiary"
                icon={biologyAuthIconName}
                onPress={onBiologyAuth}
                loading={status.value === EPasswordVerifyStatus.VERIFYING}
              />
            </YStack>
          ) : null}
        </>
      )}
    </Form>
  );
};
export default memo(PasswordVerify);
