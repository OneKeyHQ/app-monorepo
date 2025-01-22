import { useState } from 'react';

import { OTPInput, SizableText, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

function OTPInputGallery() {
  const [text, setText] = useState('');

  return (
    <Layout
      description="OTP (One-Time Password) on iOS, Android, and Web."
      elements={[
        {
          title: 'numeric',
          element: (
            <YStack>
              <SizableText>{text}</SizableText>
              <OTPInput
                numberOfDigits={6}
                type="numeric"
                onTextChange={(value) => setText(value)}
              />
            </YStack>
          ),
        },
      ]}
    />
  );
}

export default OTPInputGallery;
