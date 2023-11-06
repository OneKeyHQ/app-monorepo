import { useState } from 'react';

import { Keyboard, Text, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const Demo = () => {
  const [inputText, updateInputText] = useState('');

  return (
    <YStack space="$2">
      <Text variant="$heading3xl" color="$text">
        {inputText}
      </Text>
      <Keyboard
        pattern={/^([0-9]+|[0-9]+\.?)([0-9]{1,2})?$/}
        text={inputText}
        onTextChange={updateInputText}
      />
    </YStack>
  );
};

const SecureDemo = () => {
  const [inputText, updateInputText] = useState('');

  return (
    <YStack space="$2">
      <Text variant="$heading3xl">{inputText}</Text>
      <Keyboard
        secure
        pattern={/^([0-9]+|[0-9]+\.?)([0-9]{1,2})?$/}
        text={inputText}
        onTextChange={updateInputText}
      />
    </YStack>
  );
};

const IconGallery = () => (
  <Layout
    description="图标是一种视觉符号，用于表示对象或概念"
    suggestions={['图标的设计应该简洁、易于理解、易于识别']}
    boundaryConditions={[]}
    elements={[
      {
        title: 'Basic',
        element: <Demo />,
      },
      {
        title: 'Secure',
        element: <SecureDemo />,
      },
    ]}
  />
);

export default IconGallery;
