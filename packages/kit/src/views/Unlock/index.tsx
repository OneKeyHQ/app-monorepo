import React from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Form,
  Icon,
  Typography,
  useForm,
} from '@onekeyhq/components';

export const Unlock = () => {
  const intl = useIntl();
  const { control } = useForm();
  return (
    <Box p="4">
      <Box display="flex" flexDirection="column" alignItems="center" mt="24">
        <Icon name="BrandLogoIllus" size={50} />
        <Typography.DisplayXLarge my="2">OneKey</Typography.DisplayXLarge>
        <Typography.Body1 color="text-subdued">
          {intl.formatMessage({
            id: 'content__the_decentralized_web_awaits',
            defaultMessage: 'The decentralized web awaits',
          })}
        </Typography.Body1>
      </Box>
      <Form mt="8">
        <Form.Item
          control={control}
          name="Password"
          label={intl.formatMessage({
            id: 'form__password',
            defaultMessage: 'Password',
          })}
        >
          <Form.PasswordInput />
        </Form.Item>
        <Button size="xl">
          {intl.formatMessage({
            id: 'action__unlock',
            defaultMessage: 'Unlock',
          })}
        </Button>
      </Form>
    </Box>
  );
};

export default Unlock;
