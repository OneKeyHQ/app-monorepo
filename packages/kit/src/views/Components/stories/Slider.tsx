import { useState } from 'react';

import { Button, Dialog, Slider, Stack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const SliderGallery = () => {
  const [value, setValue] = useState(0);
  return (
    <Layout
      description=".."
      suggestions={['...']}
      boundaryConditions={['...']}
      elements={[
        {
          title: 'Default',
          element: (
            <Stack space="$2">
              <Slider
                value={value}
                onValueChange={(newValue) => {
                  console.log(newValue);
                  setValue(newValue);
                }}
              />
            </Stack>
          ),
        },
        {
          title: 'Disabled',
          element: (
            <Stack space="$2">
              <Slider disabled defaultValue={0.5} />
            </Stack>
          ),
        },
        {
          title: 'Dialog',
          element: (
            <Stack space="$2">
              <Button
                onPress={() => {
                  Dialog.confirm({
                    renderContent: (
                      <Stack paddingVertical={100}>
                        <Slider />
                      </Stack>
                    ),
                  });
                }}
              >
                打开
              </Button>
            </Stack>
          ),
        },
      ]}
    />
  );
};

export default SliderGallery;
