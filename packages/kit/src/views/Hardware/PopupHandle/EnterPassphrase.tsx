import type { FC } from 'react';

import { useKeepAwake } from 'expo-keep-awake';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Divider,
  Form,
  Icon,
  Text,
  useForm,
} from '@onekeyhq/components';
import { SkipAppLock } from '@onekeyhq/kit/src/components/AppLock';

import BaseRequestView from './BaseRequest';

import type { BaseRequestViewProps } from './BaseRequest';

type EnterPassphraseViewProps = {
  passphraseState?: string;
  onConfirm: (passphrase: string) => void;
  onDeviceInput: () => void;
} & Omit<BaseRequestViewProps, 'children'>;

type FieldValues = { value: string };

const EnterPassphraseView: FC<EnterPassphraseViewProps> = ({
  onConfirm,
  onDeviceInput,
  passphraseState,
  ...props
}) => {
  const intl = useIntl();

  // Prevents screen locking
  useKeepAwake();

  const { control, handleSubmit } = useForm<FieldValues>({
    mode: 'onChange',
    defaultValues: { value: '' },
  });

  const onSubmit = handleSubmit(({ value }: FieldValues) => {
    onConfirm(value);
  });

  return (
    <BaseRequestView {...props} closeWay="now">
      <SkipAppLock />
      <Form mt={4}>
        <Form.Item
          control={control}
          name="value"
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
            size="xl"
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
                <Icon name="EyeSlashOutline" size={20} color="icon-subdued" />
              </Box>
              <Text flex={1} ml={3} typography="Body2" color="text-default">
                {intl.formatMessage({
                  id: 'msg__use_passphrase_enter_hint_hide_wallet',
                })}
              </Text>
            </Box>
            <Box flexDirection="row" mt={4}>
              <Box>
                <Icon
                  name="ExclamationTriangleOutline"
                  size={20}
                  color="icon-warning"
                />
              </Box>
              <Text flex={1} typography="Body2" ml={3} color="text-default">
                {intl.formatMessage({
                  id: 'msg__use_passphrase_enter_hint_not_forget',
                })}
              </Text>
            </Box>
          </Box>
        </>
      )}
    </BaseRequestView>
  );
};

export default EnterPassphraseView;
