import { useState } from 'react';

import type { ISwitchProps } from '@onekeyhq/components';
import { Stack, Switch, Text } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const SwitchDemo = ({ ...rest }: ISwitchProps) => {
  const [val, setVal] = useState(false);

  return (
    <Switch
      value={val}
      onChange={() => {
        setVal(!val);
      }}
      {...rest}
    />
  );
};

const SwitchGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Sizes',
        element: (
          <Stack space="$4">
            <Stack flexDirection="row" alignItems="center" space="$2">
              <SwitchDemo />
              <Text>Small</Text>
            </Stack>
            <Stack flexDirection="row" alignItems="center" space="$2">
              <SwitchDemo size="large" />
              <Text>Large</Text>
            </Stack>
          </Stack>
        ),
      },
      {
        title: 'Status(View Only)',
        element: (
          <Stack space="$4">
            <Stack flexDirection="row" alignItems="center" space="$2">
              <SwitchDemo value={false} size="large" />
              <Text>Default</Text>
            </Stack>
            <Stack flexDirection="row" alignItems="center" space="$2">
              <SwitchDemo value={false} size="large" disabled />
              <Text>Default and disabled</Text>
            </Stack>
            <Stack flexDirection="row" alignItems="center" space="$2">
              <SwitchDemo value size="large" />
              <Text>Checked</Text>
            </Stack>
            <Stack flexDirection="row" alignItems="center" space="$2">
              <SwitchDemo value size="large" disabled />
              <Text>Checked and disabled</Text>
            </Stack>
          </Stack>
        ),
      },
    ]}
  />
);

export default SwitchGallery;
