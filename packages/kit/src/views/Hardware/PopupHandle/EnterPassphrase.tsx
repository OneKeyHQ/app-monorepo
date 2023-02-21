import { useState } from 'react';
import type { FC } from 'react';

import { useKeepAwake } from 'expo-keep-awake';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  CheckBox,
  Divider,
  Form,
  Icon,
  Text,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { SkipAppLock } from '@onekeyhq/kit/src/components/AppLock';
import { setPendingRememberWalletConnectId } from '@onekeyhq/kit/src/store/reducers/hardware';

import BaseRequestView from './BaseRequest';

import type { BaseRequestViewProps } from './BaseRequest';

type EnterPassphraseViewProps = {
  connectId: string;
  passphraseState?: string;
  onConfirm: (passphrase: string) => void;
  onDeviceInput: () => void;
} & Omit<BaseRequestViewProps, 'children'>;

type FieldValues = { passphrase: string; confirmPassphrase: string };

const SetupPassphraseView = ({
  onConfirm,
}: {
  onConfirm: (passphrase: string) => void;
}) => {
  const intl = useIntl();

  const { control, handleSubmit, setError } = useForm<FieldValues>({
    mode: 'onChange',
    defaultValues: { passphrase: '', confirmPassphrase: '' },
  });

  const onSubmit = handleSubmit(
    ({ passphrase, confirmPassphrase }: FieldValues) => {
      if (passphrase !== confirmPassphrase) {
        setError('confirmPassphrase', {
          message: intl.formatMessage({
            id: 'msg__passphrase_needs_to_be_the_same',
          }),
        });
        return;
      }

      onConfirm(passphrase);
    },
  );

  return (
    <>
      <Form mt={4} space={3}>
        <Form.Item
          control={control}
          name="passphrase"
          label=""
          rules={{
            maxLength: {
              value: 50,
              message: intl.formatMessage({
                id: 'msg__exceeding_the_maximum_word_limit',
              }),
            },
            validate: (value) => {
              if (!value.length) return true;
              // eslint-disable-next-line prefer-regex-literals
              const passphraseReg = new RegExp(
                '^[a-zA-Z0-9-><_.:@\\|*!()+%&-\\[\\]?{},#\'`;"~$\\^=]+$',
                'i',
              );
              if (!passphraseReg.test(value)) {
                return intl.formatMessage({
                  id: 'form__add_exsting_wallet_invalid',
                });
              }
            },
          }}
        >
          <Form.Input
            type="password"
            autoFocus
            size="lg"
            placeholder={intl.formatMessage({
              id: 'form__passphrase_placeholder',
            })}
            onKeyPress={(e) => {
              if (e.nativeEvent.key === 'Enter') {
                onSubmit();
              }
            }}
            onSubmitEditing={() => onSubmit()}
            returnKeyType="done"
          />
        </Form.Item>
        <Form.Item
          control={control}
          name="confirmPassphrase"
          label=""
          rules={{
            maxLength: {
              value: 50,
              message: intl.formatMessage({
                id: 'msg__exceeding_the_maximum_word_limit',
              }),
            },
            validate: (value) => {
              if (!value.length) return true;
              // eslint-disable-next-line prefer-regex-literals
              const passphraseReg = new RegExp(
                '^[a-zA-Z0-9-><_.:@\\|*!()+%&-\\[\\]?{},#\'`;"~$\\^=]+$',
                'i',
              );
              if (!passphraseReg.test(value)) {
                return intl.formatMessage({
                  id: 'form__add_exsting_wallet_invalid',
                });
              }
            },
          }}
        >
          <Form.Input
            type="password"
            size="lg"
            placeholder={intl.formatMessage({
              id: 'form__passphrase_confirm_placeholder',
            })}
            onKeyPress={(e) => {
              if (e.nativeEvent.key === 'Enter') {
                onSubmit();
              }
            }}
            onSubmitEditing={() => onSubmit()}
            returnKeyType="done"
          />
        </Form.Item>
      </Form>
      <Button type="primary" size="lg" mt={3} onPress={() => onSubmit()}>
        {intl.formatMessage({ id: 'action__confirm' })}
      </Button>
    </>
  );
};

const PassphraseView = ({
  onConfirm,
}: {
  onConfirm: (passphrase: string) => void;
}) => {
  const intl = useIntl();

  const { control, handleSubmit } = useForm<FieldValues>({
    mode: 'onChange',
    defaultValues: { passphrase: '' },
  });

  const onSubmit = handleSubmit(({ passphrase }: FieldValues) => {
    onConfirm(passphrase);
  });

  return (
    <>
      <Form mt={4}>
        <Form.Item
          control={control}
          name="passphrase"
          label=""
          rules={{
            maxLength: {
              value: 50,
              message: intl.formatMessage({
                id: 'msg__exceeding_the_maximum_word_limit',
              }),
            },
            validate: (value) => {
              if (!value.length) return true;
              // eslint-disable-next-line prefer-regex-literals
              const passphraseReg = new RegExp(
                '^[a-zA-Z0-9-><_.:@\\|*!()+%&-\\[\\]?{},#\'`;"~$\\^=]+$',
                'i',
              );
              if (!passphraseReg.test(value)) {
                return intl.formatMessage({
                  id: 'form__add_exsting_wallet_invalid',
                });
              }
            },
          }}
        >
          <Form.Input
            type="password"
            autoFocus
            size="lg"
            placeholder={intl.formatMessage({
              id: 'form__passphrase_placeholder',
            })}
            onKeyPress={(e) => {
              if (e.nativeEvent.key === 'Enter') {
                onSubmit();
              }
            }}
            onSubmitEditing={() => onSubmit()}
            returnKeyType="done"
          />
        </Form.Item>
      </Form>
      <Button type="primary" size="lg" mt={3} onPress={() => onSubmit()}>
        {intl.formatMessage({ id: 'action__confirm' })}
      </Button>
    </>
  );
};

const EnterPassphraseView: FC<EnterPassphraseViewProps> = ({
  connectId,
  onConfirm,
  onDeviceInput,
  passphraseState,
  ...props
}) => {
  const intl = useIntl();
  const { dispatch } = backgroundApiProxy;
  const [rememberWallet, setRememberWallet] = useState(false);

  // Prevents screen locking
  useKeepAwake();

  return (
    <BaseRequestView {...props} closeWay="now">
      <SkipAppLock />
      {passphraseState ? (
        <PassphraseView onConfirm={onConfirm} />
      ) : (
        <SetupPassphraseView
          onConfirm={(passphrase) => {
            dispatch(
              setPendingRememberWalletConnectId(
                rememberWallet ? connectId : undefined,
              ),
            );
            onConfirm(passphrase);
          }}
        />
      )}
      <Button
        type="plain"
        size="base"
        mt={3}
        mb={passphraseState ? 0 : 4}
        onPress={() => onDeviceInput()}
      >
        {intl.formatMessage({ id: 'msg__enter_passphrase_on_device' })}
      </Button>
      {passphraseState ? null : (
        <>
          <Divider />
          <Box mt={6}>
            <Box flexDirection="row">
              <Box>
                <CheckBox
                  isChecked={rememberWallet}
                  onChange={setRememberWallet}
                />
              </Box>
              <Box flex={1}>
                <Text typography="Body2Strong" color="text-default">
                  {intl.formatMessage({
                    id: 'msg__use_passphrase_remember_wallet',
                  })}
                </Text>
                <Text typography="Body2" color="text-subdued">
                  {intl.formatMessage({
                    id: 'msg__use_passphrase_remember_wallet_dsc',
                  })}
                </Text>
              </Box>
            </Box>
            <Box flexDirection="row" mt={4}>
              <Box>
                <Icon
                  name="ExclamationTriangleOutline"
                  size={20}
                  color="icon-warning"
                />
              </Box>
              <Box flex={1} ml={3}>
                <Text typography="Body2Strong" color="text-default">
                  {intl.formatMessage({
                    id: 'msg__use_passphrase_enter_hint_not_forget',
                  })}
                </Text>
                <Text typography="Body2" color="text-subdued">
                  {intl.formatMessage({
                    id: 'msg__use_passphrase_enter_hint_not_forget_dsc',
                  })}
                </Text>
              </Box>
            </Box>
          </Box>
        </>
      )}
    </BaseRequestView>
  );
};

export default EnterPassphraseView;
