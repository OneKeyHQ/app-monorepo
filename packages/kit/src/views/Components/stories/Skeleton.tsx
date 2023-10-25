import { useState } from 'react';

import { MotiView } from 'moti';

import { Button, Input, Skeleton, Text, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const Spacer = ({ height = 16 }: { height?: number }) => (
  <MotiView style={{ height }} />
);
const SkeletonDemo = () => (
  <MotiView
    transition={{
      type: 'timing',
    }}
    style={{
      flex: 1,
      justifyContent: 'center',
      padding: 16,
    }}
  >
    <Skeleton radius="round" height={75} width={75} />
    <Spacer />
    <Skeleton width={250} />
    <Spacer height={8} />
    <Skeleton width="100%" />
    <Spacer height={8} />
    <Skeleton width="100%" />
  </MotiView>
);

const SkeletonGroupDemo = () => {
  const [loading, setLoading] = useState(false);
  return (
    <YStack>
      <Button
        onPress={() => {
          setLoading(true);
          setTimeout(() => {
            setLoading(false);
          }, 3000);
        }}
      >
        Click it to show LoadingView
      </Button>
      <YStack paddingVertical="$6">
        <Skeleton.Group show={loading}>
          <YStack space="$4">
            <Skeleton>
              <Input />
            </Skeleton>
            <Skeleton>
              <Text>Hello Onekey</Text>
            </Skeleton>
          </YStack>
        </Skeleton.Group>
      </YStack>
    </YStack>
  );
};

const SelectGallery = () => (
  <Layout
    description="..."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: '默认状态',
        element: <SkeletonDemo />,
      },
      {
        title: '默认状态',
        element: <SkeletonGroupDemo />,
      },
    ]}
  />
);

export default SelectGallery;
