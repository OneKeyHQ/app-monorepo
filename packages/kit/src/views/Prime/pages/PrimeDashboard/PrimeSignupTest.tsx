import { useEffect, useState } from 'react';

import {
  useGuestAccounts,
  useLoginWithEmail,
  usePrivy,
} from '@privy-io/react-auth';

import { Button, Input, OTPInput, YStack } from '@onekeyhq/components';

export function PrimeSignupTest() {
  const { createGuestAccount } = useGuestAccounts();
  const { ready, authenticated, logout } = usePrivy();

  const {
    sendCode: sendCodeEmail,
    loginWithCode: loginWithCodeEmail,
    state: stateEmail,
  } = useLoginWithEmail({
    onComplete: ({ user, isNewUser, wasAlreadyAuthenticated, loginMethod }) => {
      console.log('🔑 ✅ User successfully logged in with email', {
        user,
        isNewUser,
        wasAlreadyAuthenticated,
        loginMethod,
      });
    },
    onError: (error) => {
      console.log(error);
    },
  });

  // Email Local State
  const [email, setEmail] = useState('limichange@hotmail.com');
  const [codeEmail, setCodeEmail] = useState('');
  const [emailState, setEmailState] = useState(stateEmail.status as string);

  // Update email status
  useEffect(() => {
    if (stateEmail.status === 'error' && stateEmail.error) {
      const message = `Error ${stateEmail.error.message}`;
      setEmailState(message);
    } else {
      setEmailState(stateEmail.status);
    }
  }, [stateEmail]);

  return (
    <YStack>
      <Input value={email} onChangeText={setEmail} placeholder="email" />

      <Button
        onPress={async () => {
          // await createGuestAccount();
          await sendCodeEmail({ email });
        }}
      >
        Send
      </Button>

      <OTPInput value={codeEmail} onTextChange={setCodeEmail} />

      <Button onPress={() => loginWithCodeEmail({ code: codeEmail })}>
        login
      </Button>
    </YStack>
  );
}
