import { useState } from 'react';

import type { ISwitchProps } from '@onekeyhq/components';
import { ESwitchSize, SizableText, Stack, Switch } from '@onekeyhq/components';

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
              <SizableText>Small</SizableText>
            </Stack>
            <Stack flexDirection="row" alignItems="center" space="$2">
              <SwitchDemo size={ESwitchSize.large} />
              <SizableText>Large</SizableText>
            </Stack>
          </Stack>
        ),
      },
      {
        title: 'Status(View Only)',
        element: (
          <Stack space="$4">
            <Stack flexDirection="row" alignItems="center" space="$2">
              <SwitchDemo value={false} size={ESwitchSize.large} />
              <SizableText>Default</SizableText>
            </Stack>
            <Stack flexDirection="row" alignItems="center" space="$2">
              <SwitchDemo value={false} size={ESwitchSize.large} disabled />
              <SizableText>Default and disabled</SizableText>
            </Stack>
            <Stack flexDirection="row" alignItems="center" space="$2">
              <SwitchDemo value size={ESwitchSize.large} />
              <SizableText>Checked</SizableText>
            </Stack>
            <Stack flexDirection="row" alignItems="center" space="$2">
              <SwitchDemo value size={ESwitchSize.large} disabled />
              <SizableText>Checked and disabled</SizableText>
            </Stack>
          </Stack>
        ),
      },
    ]}
  />
);

export default SwitchGallery;
