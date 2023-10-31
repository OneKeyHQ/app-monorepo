import { useState } from 'react';

import { Button, Dialog, Slider, Stack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const SliderDemo = () => {
  const [value, setValue] = useState(0);
  return (
    <Stack space="$2">
      <Slider
        value={value}
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
        element: <Slider width="$60" height="$10" m="$8" />,
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

export default SliderGallery;
