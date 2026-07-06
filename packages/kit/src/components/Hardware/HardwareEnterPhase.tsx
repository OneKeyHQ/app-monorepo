import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Anchor,
  Button,
  ESwitchSize,
  Form,
  IconButton,
  Input,
  Popover,
  SizableText,
  Stack,
  Switch,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import {
  type UseFormReturn,
  useForm,
} from '@onekeyhq/components/src/hooks/useForm';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { isPassphraseValid } from '../../utils/passphraseUtils';

interface IEnterPhaseFormValues {
  passphrase: string;
  confirmPassphrase: string;
  hideImmediately: boolean;
}

export type IEnterPhaseProps = {
  isVerifyMode?: boolean;
  allowUseAttachPin?: boolean;
  onConfirm: (p: {
    passphrase: string;
    save: boolean;
    hideImmediately: boolean;
  }) => void;
  switchOnDevice: ({ hideImmediately }: { hideImmediately: boolean }) => void;
  switchOnDeviceAttachPin: ({
    hideImmediately,
  }: {
    hideImmediately: boolean;
  }) => void;
};

export function EnterPhase({
  isVerifyMode,
  allowUseAttachPin,
  onConfirm,
  switchOnDevice,
  switchOnDeviceAttachPin,
}: IEnterPhaseProps) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const formOption = useMemo(
    () => ({
      defaultValues: {
        passphrase: '',
        confirmPassphrase: '',
        hideImmediately:
          settings.hiddenWalletImmediately === undefined
            ? true
            : settings.hiddenWalletImmediately,
      },
      onSubmit: async (form: UseFormReturn<IEnterPhaseFormValues>) => {
        const values = form.getValues();
        const passphrase = values.passphrase || '';
        onConfirm({
          passphrase,
          save: true,
          hideImmediately: values.hideImmediately,
        });
      },
    }),
    [onConfirm, settings.hiddenWalletImmediately],
  );
  const form = useForm<IEnterPhaseFormValues>(formOption);

  const handleSwitchOnDevice = useCallback(() => {
    switchOnDevice({ hideImmediately: form.getValues().hideImmediately });
  }, [form, switchOnDevice]);

  const handleSwitchOnDeviceAttachPin = useCallback(() => {
    switchOnDeviceAttachPin({
      hideImmediately: form.getValues().hideImmediately,
    });
  }, [form, switchOnDeviceAttachPin]);

  const media = useMedia();
  const [secureEntry1, setSecureEntry1] = useState(true);

  // Watch passphrase input to control button state
  const passphraseValue = form.watch('passphrase');
  const isButtonDisabled = isVerifyMode
    ? false
    : !passphraseValue || passphraseValue === '';

  return (
    <Stack>
      <Stack pb="$5">
        <Alert
          title={intl.formatMessage({
            id: ETranslations.global_enter_passphrase_alert,
          })}
          type="warning"
        />
      </Stack>
      <Form form={form}>
        <Form.Field
          name="passphrase"
          label={intl.formatMessage({ id: ETranslations.global_passphrase })}
          description={
            <XStack gap="$1" pt="$2">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.passphrase_character_limit,
                })}
              </SizableText>
              <Popover
                placement="bottom"
                floatingPanelProps={{
                  width: '$80',
                }}
                title={intl.formatMessage({
                  id: ETranslations.passphrase_allowed_characters_title,
                })}
                renderTrigger={
                  <IconButton
                    testID="hardware-ui-passphrase-info-btn"
                    variant="tertiary"
                    size="small"
                    icon="InfoCircleOutline"
                  />
                }
                renderContent={() => (
                  <Stack
                    p="$5"
                    $md={{
                      pt: '$0',
                    }}
                  >
                    <Anchor
                      href="https://www.ascii-code.com/"
                      size="$bodyMd"
                      color="$textInfo"
                    >
                      {intl.formatMessage({
                        id: ETranslations.passphrase_allowed_characters_desc,
                      })}
                    </Anchor>
                  </Stack>
                )}
              />
            </XStack>
          }
          labelAddon={
            <Button
              testID="hardware-ui-passphrase-switch-on-device-btn"
              variant="tertiary"
              size="small"
              icon="OnekeyDeviceCustom"
              onPress={handleSwitchOnDevice}
            >
              {intl.formatMessage({
                id: ETranslations.global_enter_on_device,
              })}
            </Button>
          }
          rules={{
            maxLength: {
              value: 50,
              message: intl.formatMessage(
                {
                  id: ETranslations.hardware_passphrase_enter_too_long,
                },
                {
                  0: 50,
                },
              ),
            },
            validate: (text) => {
              const valid = isPassphraseValid(text);
              if (valid) {
                return undefined;
              }
              return intl.formatMessage({
                id: ETranslations.hardware_unsupported_passphrase_characters,
              });
            },
            onChange: () => {
              form.clearErrors();
            },
          }}
        >
          <Input
            testID="hardware-ui-passphrase-input"
            secureTextEntry={secureEntry1}
            placeholder={intl.formatMessage({
              id: ETranslations.global_enter_passphrase,
            })}
            addOns={[
              {
                iconName: secureEntry1 ? 'EyeOutline' : 'EyeOffOutline',
                testID: 'hardware-ui-passphrase-eye-btn',
                onPress: () => {
                  setSecureEntry1(!secureEntry1);
                },
              },
            ]}
            {...(media.md && {
              size: 'large',
            })}
          />
        </Form.Field>
        {!isVerifyMode ? (
          <Form.Field
            horizontal
            name="hideImmediately"
            description={
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage(
                  {
                    id: ETranslations.hidden_wallet_accessibility_title,
                  },
                  {
                    // eslint-disable-next-line react/no-unstable-nested-components
                    strong: (chunks: ReactNode[]) => (
                      <SizableText size="$bodyMdMedium" color="$text">
                        {chunks}
                      </SizableText>
                    ),
                  },
                )}
              </SizableText>
            }
          >
            <Switch
              testID="hardware-ui-passphrase-hide-immediately-switch"
              size={ESwitchSize.small}
            />
          </Form.Field>
        ) : null}
      </Form>
      {/* TODO: add loading state while waiting for result */}
      <Button
        testID="hardware-ui-passphrase-confirm-btn"
        mt="$5"
        $md={
          {
            size: 'large',
          } as any
        }
        variant="primary"
        disabled={isButtonDisabled}
        onPress={form.submit}
      >
        {intl.formatMessage({ id: ETranslations.global_confirm })}
      </Button>
      {allowUseAttachPin ? (
        <Button
          testID="hardware-ui-passphrase-attach-pin-btn"
          m="$0"
          mt="$2.5"
          $md={
            {
              size: 'large',
            } as any
          }
          variant="secondary"
          onPress={handleSwitchOnDeviceAttachPin}
        >
          {intl.formatMessage({
            id: ETranslations.global_enter_hidden_wallet_pin,
          })}
        </Button>
      ) : null}
    </Stack>
  );
}
