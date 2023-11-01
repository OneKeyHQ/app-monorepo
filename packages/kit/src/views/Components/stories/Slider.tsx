import { useState } from 'react';

import { Button, Dialog, Slider, Stack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const SliderDemo = () => {
  const [value, setValue] = useState(0);
  return (
    <Stack space="$2">
      <Slider
        value={value}
        min={1}
        max={100}
        step={0.01}
        onChange={(v) => {
          console.log(v);
          setValue(v);
        }}
      />
    </Stack>
  );
};

const SliderGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Default',
        element: <SliderDemo />,
      },
      {
        title: 'Styled',
        element: (
          <Slider
            width="$60"
            height="$10"
            m="$8"
            min={100}
            max={1000}
            step={1}
            onChange={console.log}
          />
        ),
      },
      {
        title: 'Disabled',
        element: (
          <Stack space="$2">
            <Slider disabled min={1} max={100} value={50} step={1} />
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
                      <Slider min={1} max={100} step={1} />
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

export default SliderGallery;
