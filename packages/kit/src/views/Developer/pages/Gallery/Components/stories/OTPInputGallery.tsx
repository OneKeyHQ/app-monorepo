import { useState } from 'react';

import { Button, OTPInput, SizableText, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

function OTPInputGallery() {
  const [value, setText] = useState('');

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
                onTextChange={(newValue) => setText(newValue)}
              />

              <SizableText>value: {value}</SizableText>

              <Button onPress={() => setText('')}>Clear</Button>
            </YStack>
          ),
        },
      ]}
    />
  );
}

export default OTPInputGallery;
