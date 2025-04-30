import { useState } from 'react';

import { useLoginWithEmail } from '@privy-io/expo';

import { Button, Input, OTPInput, Toast, YStack } from '@onekeyhq/components';

export function PrimeSignupTest() {
  const [email, setEmail] = useState('limichange@hotmail.com');
  const { sendCode, loginWithCode } = useLoginWithEmail({
    onSendCodeSuccess() {
      Toast.message({
        title: 'onSendCodeSuccess',
      });
    },
    onLoginSuccess(user) {
      Toast.success({
        title: 'onLoginSuccess',
        message: `user${JSON.stringify(user, null, 2)}`,
      });
    },
    onError(error) {
      console.log('error', error);
      // show a toast, update form errors, etc...
    },
  });
  const [codeEmail, setCodeEmail] = useState('');
  return (
    <YStack>
      <Input
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        inputMode="email"
      />
      <Button onPress={() => sendCode({ email })}>Send Code</Button>
      <OTPInput value={codeEmail} onTextChange={setCodeEmail} />
      <Button onPress={() => loginWithCode({ code: codeEmail, email })}>
        Login
      </Button>
    </YStack>
  );
}
