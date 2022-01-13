import React from 'react';

import {
  Box,
  Button,
  Form,
  KeyboardDismissView,
  Typography,
} from '@onekeyhq/components';

const EnterMasterPassword = () => (
  <KeyboardDismissView>
    <Typography.DisplayLarge>Enter Master Password</Typography.DisplayLarge>
    <Typography.Body1>
      Enter the old password before resetting it
    </Typography.Body1>
    <Form>
      <Form.Item name="password" label="Password">
        <Form.PasswordInput />
      </Form.Item>
      <Button>Continue</Button>
    </Form>
  </KeyboardDismissView>
);

const SetMasterPassword = () => (
  <KeyboardDismissView>
    <Typography.DisplayLarge>Set Master Password</Typography.DisplayLarge>
    <Typography.Body1>Only you can unlock your wallet</Typography.Body1>
    <Form>
      <Form.Item name="password" label="Password">
        <Form.PasswordInput />
      </Form.Item>
      <Form.Item name="confirmPassword" label="Confirm Password">
        <Form.PasswordInput />
      </Form.Item>
      <Button>Continue</Button>
    </Form>
  </KeyboardDismissView>
);

export const ChangeMasterPassword = () => (
  <Box>
    <EnterMasterPassword />
    <SetMasterPassword />
  </Box>
);

export default ChangeMasterPassword;
