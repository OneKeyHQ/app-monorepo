import React, { useState } from 'react';

import BigNumber from 'bignumber.js';

import { Center, Keyboard, Text } from '@onekeyhq/components';

const KeyboardGallery = () => {
  const [inputText, updateInputText] = useState('');
  return (
    <Center flex="1" bg="background-hovered">
      <Text mb={50} typography="DisplayXLarge">
        {inputText}
      </Text>
      <Keyboard
        // keys={['1', '3', '4', '2', '7', '8', '5', '9', '6']}
        // secure
        onKeyPress={(key) => {
          updateInputText((prev) => {
            const result = new BigNumber(prev + key);
            if (!result.isNaN()) {
              return prev + key;
            }
            return prev;
          });
        }}
        onDelete={() => {
          updateInputText((prev) => {
            const result = prev.slice(0, prev.length - 1);
            if (result.slice(result.length - 1, result.length) === '.') {
              return result.slice(0, result.length - 1);
            }
            return result;
          });
        }}
      />
    </Center>
  );
};

export default KeyboardGallery;
