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
    filePath={__CURRENT_FILE_PATH__}
    componentName="Switch"
    elements={[
      {
        title: 'Sizes',
        element: (
          <Stack gap="$4">
            <Stack flexDirection="row" alignItems="center" gap="$2">
              <SwitchDemo size={ESwitchSize.small} />
              <SizableText>Small</SizableText>
            </Stack>
            <Stack flexDirection="row" alignItems="center" gap="$2">
              <SwitchDemo size={ESwitchSize.large} />
              <SizableText>Large</SizableText>
            </Stack>
          </Stack>
        ),
      },
      {
        title: 'Status(View Only)',
        element: (
          <Stack gap="$4">
            <Stack flexDirection="row" alignItems="center" gap="$2">
              <SwitchDemo value={false} size={ESwitchSize.large} />
              <SizableText>Default</SizableText>
            </Stack>
            <Stack flexDirection="row" alignItems="center" gap="$2">
              <SwitchDemo value={false} size={ESwitchSize.large} disabled />
              <SizableText>Default and disabled</SizableText>
            </Stack>
            <Stack flexDirection="row" alignItems="center" gap="$2">
              <SwitchDemo value size={ESwitchSize.large} />
              <SizableText>Checked</SizableText>
            </Stack>
            <Stack flexDirection="row" alignItems="center" gap="$2">
              <SwitchDemo value size={ESwitchSize.large} disabled />
              <SizableText>Checked and disabled</SizableText>
            </Stack>
          </Stack>
        ),
      },
      {
        title: 'ThumbProps',
        element: (
          <Stack gap="$4">
            <Stack flexDirection="row" alignItems="center" gap="$2">
              <SwitchDemo
                size={ESwitchSize.large}
                thumbProps={{
                  bg: '$bgWarning',
                }}
              />
              <SizableText>Custom thumb color</SizableText>
            </Stack>
            <Stack flexDirection="row" alignItems="center" gap="$2">
              <SwitchDemo
                size={ESwitchSize.large}
                thumbProps={{
                  animation: '0ms',
                }}
              />
              <SizableText>Custom thumb animation</SizableText>
            </Stack>
            <Stack flexDirection="row" alignItems="center" gap="$2">
              <SwitchDemo
                size={ESwitchSize.large}
                thumbProps={{
                  borderWidth: '$1',
                  borderColor: '$borderStrong',
                }}
              />
              <SizableText>Custom thumb border</SizableText>
            </Stack>
          </Stack>
        ),
      },
    ]}
  />
);

export default SwitchGallery;
