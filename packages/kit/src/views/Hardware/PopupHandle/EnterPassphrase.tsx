import { FC } from 'react';

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

import BaseRequestView, { BaseRequestViewProps } from './BaseRequest';

type EnterPassphraseViewProps = {
  onConfirm: (passphrase: string) => void;
  onDeviceInput: () => void;
} & Omit<BaseRequestViewProps, 'children'>;

type FieldValues = { value: string };

const EnterPassphraseView: FC<EnterPassphraseViewProps> = ({
  onConfirm,
  onDeviceInput,
  ...props
}) => {
  const intl = useIntl();

  const { control, handleSubmit } = useForm<FieldValues>({
    mode: 'onChange',
    defaultValues: { value: '' },
  });

  const onSubmit = handleSubmit(({ value }: FieldValues) => {
    onConfirm(value);
  });

  return (
    <BaseRequestView {...props}>
      {/* TODO: temporary margin-top */}
      <Form mt={6}>
        <Form.Item
          control={control}
          name="value"
          label=""
          rules={{
            validate: (value) => {
              if (!value.length) return true;
              const passphraseReg = new RegExp(
                '^[a-zA-Z0-9-><_.:@\\|*!()+%&-\\[\\]?{},\'`;"~$\\^=]+$',
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
            autoFocus
            size="lg"
            placeholder={intl.formatMessage({
              id: 'form__passphrase_placeholder',
            })}
            rightIconName="ArrowRightOutline"
            onPressRightIcon={() => onSubmit()}
            onKeyPress={(e) => {
              console.log('current key = ', e.nativeEvent.key);
              if (e.nativeEvent.key === 'Enter') {
                onSubmit();
              }
            }}
            onSubmitEditing={() => onSubmit()}
            returnKeyType="done"
          />
        </Form.Item>
      </Form>
      <Button
        type="plain"
        size="base"
        mt={3}
        mb={6}
        onPress={() => onDeviceInput()}
      >
        {intl.formatMessage({ id: 'msg__enter_passphrase_on_device' })}
      </Button>
      <Divider />
      <Box mt={6}>
        <Box flexDirection="row">
          <Box>
            <Icon name="EyeOffOutline" size={20} color="icon-subdued" />
          </Box>
          <Text flex={1} ml={3} typography="Body2" color="text-default">
            {intl.formatMessage({
              id: 'msg__use_passphrase_enter_hint_hide_wallet',
            })}
          </Text>
        </Box>
        <Box flexDirection="row" mt={4}>
          <Box>
            <Icon name="ExclamationOutline" size={20} color="icon-warning" />
          </Box>
          <Text flex={1} typography="Body2" ml={3} color="text-default">
            {intl.formatMessage({
              id: 'msg__use_passphrase_enter_hint_not_forget',
            })}
          </Text>
        </Box>
      </Box>
    </BaseRequestView>
  );
};

export default EnterPassphraseView;
