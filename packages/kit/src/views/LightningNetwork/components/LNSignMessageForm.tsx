import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Box, Form, Text } from '@onekeyhq/components';
import { TxInteractInfo } from '@onekeyhq/kit/src/views/TxDetail/components/TxInteractInfo';

import { useInteractWithInfo } from '../../../hooks/useDecodedTx';

import type { UseFormReturn } from 'react-hook-form';

export type ISignMessageFormValues = {
  requestFrom: string;
  message: string;
  signature: string;
};

export type ISignMessageFormProps = {
  accountId: string;
  networkId: string;
  useFormReturn: UseFormReturn<ISignMessageFormValues, any>;
  origin: string;
  message: string;
  signature?: string;
};

const LNSignMessageForm = (props: ISignMessageFormProps) => {
  const { networkId, useFormReturn, origin, message, signature } = props;
  const intl = useIntl();

  const { control } = useFormReturn;

  const interactInfo = useInteractWithInfo({
    sourceInfo: {
      id: 'mockId',
      hostname: '',
      scope: 'webln',
      origin,
      data: {
        method: 'signMessage',
      },
    },
  });

  return (
    <Form>
      <Form.Item
        label={intl.formatMessage({ id: 'form__request_from' })}
        name="requestFrom"
        control={control}
        formControlProps={{ width: 'full' }}
      >
        <TxInteractInfo
          origin={interactInfo?.url ?? ''}
          name={interactInfo?.name}
          icon={interactInfo?.icons[0]}
          networkId={networkId}
          mb={0}
        />
      </Form.Item>
      <Form.Item
        label={intl.formatMessage({
          id: 'form__message_uppercase',
        })}
        control={control}
        name="message"
        formControlProps={{ width: 'full' }}
        defaultValue=""
      >
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="flex-start"
          alignItems="center"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="border-default"
          borderRadius="xl"
          py={2}
          px={3}
          bgColor="action-secondary-default"
        >
          <Text typography="Body2Mono" color="text-subdued" lineHeight="1.5em">
            {message}
          </Text>
        </Box>
      </Form.Item>
      {signature && signature.length > 0 ? (
        <Form.Item
          // TODO: i18n
          label="Signature"
          control={control}
          name="message"
          formControlProps={{ width: 'full' }}
          defaultValue=""
        >
          <Box
            display="flex"
            flexDirection="row"
            justifyContent="flex-start"
            alignItems="center"
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="border-default"
            borderRadius="xl"
            py={2}
            px={3}
            bgColor="action-secondary-default"
          >
            <Text
              typography="Body2Mono"
              color="text-subdued"
              lineHeight="1.5em"
              numberOfLines={10}
            >
              {signature}
            </Text>
          </Box>
        </Form.Item>
      ) : null}
    </Form>
  );
};
export default LNSignMessageForm;
