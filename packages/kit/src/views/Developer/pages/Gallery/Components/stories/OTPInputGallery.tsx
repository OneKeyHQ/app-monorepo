import { useState } from 'react';

import { Button, OTPInput, SizableText, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

function OTPInputGallery() {
  const [value, setText] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);

  return (
    <Layout
      description="OTP (One-Time Password) on iOS, Android, and Web."
      elements={[
        {
          title: '6 numeric',
          element: (
            <YStack gap={6}>
              <OTPInput
                numberOfDigits={6}
                type="numeric"
                value={value}
                onTextChange={setText}
                onComplete={() => setIsCompleted(true)}
              />

              <SizableText>
                value: {value}, isCompleted: {isCompleted ? 'true' : 'false'}
              </SizableText>

              <Button
                onPress={() => {
                  setText('');
                  setIsCompleted(false);
                }}
              >
                reset
              </Button>
            </YStack>
          ),
        },
      ]}
    />
  );
}

export default OTPInputGallery;
