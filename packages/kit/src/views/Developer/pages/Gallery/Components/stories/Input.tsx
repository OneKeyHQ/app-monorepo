import { useRef } from 'react';

import { YStack } from 'tamagui';

import type { IInputRef } from '@onekeyhq/components';
import { Button, Input, Stack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const RefInput = () => {
  const ref = useRef<IInputRef | null>(null);
  return (
    <YStack>
      <Button
        onPress={() => {
          ref.current?.focus();
        }}
      >
        focus input
      </Button>
      <Input ref={ref} />
    </YStack>
  );
};

const InputGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: '',
        element: (
          <Input
            size="small"
            bg="blue"
            placeholder="1111"
            $gtMd={{
              bg: 'red',
              size: 'large',
            }}
            addOns={[
              {
                label: 'Paste',
                onPress: () => {
                  console.log('clicked');
                },
              },
            ]}
          />
        ),
      },
    ]}
  />
);

export default InputGallery;
