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
  SizableText,
  Stack,
  XStack,
  YStack,
  onVisibilityStateChange,
  useThemeName,
} from '@onekeyhq/components';
import { useForm } from '@onekeyhq/components/src/hooks/useForm';
import { usePasswordPersistManualLockStateAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EPasswordMode,
  EPasswordVerifyStatus,
} from '@onekeyhq/shared/types/password';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useBiometricAuthInfo } from '../../../hooks/useBiometricAuthInfo';
import { useHandleAppStateActive } from '../../../hooks/useHandleAppStateActive';
import { inAppStateLockDialogProps } from '../../../views/Setting/hooks';
import { useClearInputValueAfterVerified } from '../hooks/useClearInputValueAfterVerified';
import { getPasswordKeyboardType } from '../utils';

import PassCodeInput from './PassCodeInput';

import type { AuthenticationType } from 'expo-local-authentication';

type IBiometricCheckResult = 'unchanged' | 'changed' | 'unavailable';

interface IPasswordVerifyProps {
  authType: AuthenticationType[];
  isEnable: boolean;
  disableInput?: boolean;
  passwordMode: EPasswordMode;
  onPasswordChange: (e: any) => void;
  onBiologyAuth: () => void | Promise<void>;
  onInputPasswordAuth: (data: IPasswordVerifyForm) => void;
  status: {
    value: EPasswordVerifyStatus;
    message?: string;
  };
  alertText?: string;
  confirmBtnDisabled?: boolean;
  pageMode?: boolean;
  // True only while this verify UI is the app-state lock screen. The
  // lock-screen dialog props target a portal container that only the lock
  // screen hosts, so a prompt rendered anywhere else must not use them — it
  // would have nowhere to render.
  inAppStateLock?: boolean;
}

export interface IPasswordVerifyForm {
  password: string;
  passCode: string;
}

function PasswordCooldownText({ text }: { text: string }) {
  const themeName = useThemeName();
  return (
    <XStack alignSelf="center" w="$45" h="$10" borderRadius="$2.5">
      <SizableText
        size="$bodyMd"
        color={themeName === 'dark' ? '$textOnColor' : '$textOnBrightColor'}
      >
        {text}
      </SizableText>
    </XStack>
  );
}

function PasswordVerify({
  pageMode,
  inAppStateLock,
  isEnable,
  alertText,
  confirmBtnDisabled,
  disableInput,
  status,
  passwordMode,
  onBiologyAuth,
  onPasswordChange,
  onInputPasswordAuth,
}: IPasswordVerifyProps) {
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

  const statusRef = useRef(status.value);
  statusRef.current = status.value;

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
  const biometricCheckRef = useRef<IBiometricCheckResult | undefined>(
    undefined,
  );
  const biometricCheckPromiseRef =
    useRef<Promise<IBiometricCheckResult> | null>(null);
  const biometricCheckGenerationRef = useRef(0);
  const biometricAuthPromiseRef = useRef<Promise<void> | null>(null);
  const [biometricCheckResult, setBiometricCheckResult] =
    useState<IBiometricCheckResult>();
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  useEffect(() => {
    if (status.value === EPasswordVerifyStatus.VERIFIED) {
      biometricCheckGenerationRef.current += 1;
      biometricCheckRef.current = undefined;
      biometricCheckPromiseRef.current = null;
      biometricAuthPromiseRef.current = null;
      setBiometricCheckResult(undefined);
    }
  }, [status.value]);
  const passwordInput = form.watch(
    passwordMode === EPasswordMode.PASSWORD ? 'password' : 'passCode',
  );
  const [{ manualLocking }] = usePasswordPersistManualLockStateAtom();
  const { icon: biologyAuthIconName, title: authTitle } =
    useBiometricAuthInfo();

  const formContainerRef = useClearInputValueAfterVerified(status.value);

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

  const checkAuthChanged = useCallback((): Promise<IBiometricCheckResult> => {
    if (
      biometricCheckRef.current === 'changed' ||
      biometricCheckRef.current === 'unavailable'
    ) {
      return Promise.resolve(biometricCheckRef.current);
    }
    if (biometricCheckPromiseRef.current)
      return biometricCheckPromiseRef.current;
    const generation = biometricCheckGenerationRef.current;
    const checking = (async (): Promise<IBiometricCheckResult> => {
      try {
        const changed =
          await backgroundApiProxy.servicePassword.checkBiometricAuthChanged();
        if (generation !== biometricCheckGenerationRef.current)
          return 'unavailable';
        defaultLogger.setting.page.biologyAuthDebug('checkAuthChanged:result', {
          platform: platformEnv.symbol,
          changed,
        });
        if (changed) {
          // Latch before persistent settings work, so other entry points cannot race it.
          biometricCheckRef.current = 'changed';
          if (mountedRef.current) setBiometricCheckResult('changed');
          setTimeout(() => {
            if (!mountedRef.current) return;
            Dialog.confirm({
              icon: 'ErrorOutline',
              tone: 'warning',
              // Off the lock screen this takes the default portal, which is
              // where the passcode prompt that raises it already lives
              // (PasswordVerifyPromptMount passes no container on native), so
              // the warning stacks above it as the later child. Only the lock
              // screen needs a container of its own.
              ...(inAppStateLock ? inAppStateLockDialogProps : undefined),
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
          return 'changed';
        }
        biometricCheckRef.current = 'unchanged';
        if (mountedRef.current) setBiometricCheckResult('unchanged');
        return 'unchanged';
      } catch {
        if (generation !== biometricCheckGenerationRef.current)
          return 'unavailable';
        defaultLogger.setting.page.biologyAuthDebug(
          'checkAuthChanged:unavailable',
          { platform: platformEnv.symbol },
        );
        if (biometricCheckRef.current !== 'changed')
          biometricCheckRef.current = 'unavailable';
        if (mountedRef.current) setBiometricCheckResult('unavailable');
        return biometricCheckRef.current;
      }
    })();
    const tracked = checking.finally(() => {
      if (biometricCheckPromiseRef.current === tracked)
        biometricCheckPromiseRef.current = null;
    });
    biometricCheckPromiseRef.current = tracked;
    return tracked;
  }, [authTitle, inAppStateLock, intl]);

  const guardedBiologyAuth = useCallback((): Promise<void> => {
    if (biometricAuthPromiseRef.current) return biometricAuthPromiseRef.current;
    const field =
      passwordMode === EPasswordMode.PASSWORD ? 'password' : 'passCode';
    const inputBeforeCheck = form.getValues(field);
    const statusBeforeCheck = statusRef.current;
    const generation = biometricCheckGenerationRef.current;
    const attempting = (async () => {
      const result =
        platformEnv.isNativeIOS || platformEnv.isDesktopMac
          ? await checkAuthChanged()
          : 'unchanged';
      if (
        result === 'unchanged' &&
        generation === biometricCheckGenerationRef.current &&
        mountedRef.current &&
        isEnableRef.current &&
        form.getValues(field) === inputBeforeCheck &&
        statusRef.current !== EPasswordVerifyStatus.VERIFYING &&
        (statusRef.current !== EPasswordVerifyStatus.VERIFIED ||
          (pageMode && statusBeforeCheck === EPasswordVerifyStatus.VERIFIED))
      )
        await onBiologyAuth();
    })();
    const tracked = attempting.finally(() => {
      if (biometricAuthPromiseRef.current === tracked)
        biometricAuthPromiseRef.current = null;
    });
    biometricAuthPromiseRef.current = tracked;
    return tracked;
  }, [checkAuthChanged, onBiologyAuth, form, passwordMode, pageMode]);

  useLayoutEffect(() => {
    void (async () => {
      // Skip auto-trigger in MV3 sidepanel: WebAuthn modal can deadlock when
      // bound to Google Password Manager, and sidepanel lacks the popup
      // focus-loss escape that lets users recover. See PR #11125.
      if (
        !platformEnv.isExtensionUiSidePanel &&
        isEnable &&
        !passwordInput &&
        status.value === EPasswordVerifyStatus.DEFAULT &&
        !manualLocking
      ) {
        void guardedBiologyAuth();
      }
    })();

    if (platformEnv.isNativeIOS || platformEnv.isDesktopMac) {
      const handleVisibilityStateChange = (visible: boolean) => {
        if (visible && isEnableRef.current) {
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
  // Same sidepanel carve-out as the mount-time effect above.
  const onActive = useCallback(() => {
    const now = Date.now();
    if (now - lastTime.current > 1000) {
      lastTime.current = now;
      if (
        !platformEnv.isExtensionUiSidePanel &&
        isEnable &&
        !passwordInput &&
        status.value === EPasswordVerifyStatus.DEFAULT &&
        !manualLocking
      ) {
        void guardedBiologyAuth();
      }
    }
  }, [
    isEnable,
    passwordInput,
    status.value,
    manualLocking,
    guardedBiologyAuth,
  ]);

  useHandleAppStateActive(isEnable ? onActive : undefined);

  const rightActions = useMemo(() => {
    const actions: IPropsWithTestId<{
      iconName?: IKeyOfIcons;
      onPress?: () => void;
      loading?: boolean;
      disabled?: boolean;
      tabIndex?: number;
    }>[] = [];
    if (
      isEnable &&
      !passwordInput &&
      biometricCheckResult !== 'changed' &&
      biometricCheckResult !== 'unavailable'
    ) {
      actions.push({
        iconName: biologyAuthIconName,
        onPress: () => {
          void guardedBiologyAuth();
        },
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
        tabIndex: 0,
      });
    }

    return actions;
  }, [
    isEnable,
    passwordInput,
    biologyAuthIconName,
    guardedBiologyAuth,
    biometricCheckResult,
    status.value,
    secureEntry,
    form,
    onInputPasswordAuth,
    confirmBtnDisabled,
  ]);

  const onPassCodeComplete = useCallback(() => {
    setTimeout(() => {
      void form.handleSubmit(onInputPasswordAuth)();
    });
  }, [form, onInputPasswordAuth]);

  return (
    <Stack ref={formContainerRef as any}>
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
                editable={status.value !== EPasswordVerifyStatus.VERIFYING}
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
                onSubmitEditing={
                  confirmBtnDisabled
                    ? undefined
                    : form.handleSubmit(onInputPasswordAuth)
                }
                addOns={rightActions}
                testID="password-input"
              />
            </Form.Field>
            {alertText ? <PasswordCooldownText text={alertText} /> : null}
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
                  if (pageMode) {
                    onPasswordChange(pin);
                  }
                }}
                editable={status.value !== EPasswordVerifyStatus.VERIFYING}
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
            {isEnable &&
            biometricCheckResult !== 'changed' &&
            biometricCheckResult !== 'unavailable' ? (
              <YStack alignSelf="center" pt="$6" scale={1.5}>
                <IconButton
                  testID="password-icon-btn"
                  size="large"
                  variant="tertiary"
                  icon={biologyAuthIconName}
                  onPress={() => {
                    void guardedBiologyAuth();
                  }}
                  loading={status.value === EPasswordVerifyStatus.VERIFYING}
                />
              </YStack>
            ) : null}
          </>
        )}
      </Form>
      {isEnable && biometricCheckResult === 'unavailable' ? (
        <SizableText size="$bodyMd" color="$textCritical">
          {intl.formatMessage(
            { id: ETranslations.auth_biometric_failed },
            { biometric: authTitle },
          )}
        </SizableText>
      ) : null}
    </Stack>
  );
}
export default memo(PasswordVerify);
