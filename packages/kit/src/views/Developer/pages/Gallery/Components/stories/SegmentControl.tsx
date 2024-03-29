import { useState } from 'react';

import { SegmentControl, SizableText, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const SegmentControlExample1 = () => {
  const [value, setValue] = useState(1);
  return (
    <SegmentControl
      value={value}
      onChange={(v) => {
        setValue(v as number);
      }}
      options={[
        { label: 'Label 1', value: 1 },
        { label: 'Label 2', value: 2 },
        { label: 'Label 3', value: 3 },
      ]}
    />
  );
};

const SegmentControlExample2 = () => {
  const [value, setValue] = useState(1);
  return (
    <SegmentControl
      fullWidth
      value={value}
      onChange={(v) => {
        setValue(v as number);
      }}
      options={[
        { label: 'Label 1', value: 1 },
        { label: 'Label 2', value: 2 },
        { label: 'Label 3', value: 3 },
      ]}
    />
  );
};

const SegmentControlExample3 = () => {
  const [value, setValue] = useState(1);
  return (
    <SegmentControl
      fullWidth
      value={value}
      onChange={(v) => {
        setValue(v as number);
      }}
      options={[
        {
          label: (
            <YStack>
              <SizableText
                textAlign="center"
                color={value === 1 ? '$text' : '$textSubdued'}
              >
                a
              </SizableText>
              <SizableText color="$textSubdued" textAlign="center">
                1
              </SizableText>
            </YStack>
          ),
          value: 1,
        },
        {
          label: (
            <YStack>
              <SizableText
                textAlign="center"
                color={value === 2 ? '$text' : '$textSubdued'}
              >
                b
              </SizableText>
              <SizableText color="$textSubdued" textAlign="center">
                2
              </SizableText>
            </YStack>
          ),
          value: 2,
        },
        {
          label: (
            <YStack>
              <SizableText
                textAlign="center"
                color={value === 3 ? '$text' : '$textSubdued'}
              >
                c
              </SizableText>
              <SizableText color="$textSubdued" textAlign="center">
                3
              </SizableText>
            </YStack>
          ),
          value: 3,
        },
      ]}
    />
  );
};

const SegmentControlGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Default',
        element: <SegmentControlExample1 />,
      },
      {
        title: 'Full Width',
        element: <SegmentControlExample2 />,
      },
      {
        title: 'Custom Label',
        element: <SegmentControlExample3 />,
      },
    ]}
  />
);

export default SegmentControlGallery;
