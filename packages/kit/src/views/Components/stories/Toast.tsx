import { useToastController, useToastState } from '@tamagui/toast';
import { Button } from 'tamagui';

import { Toast, XStack, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const ToastControl = () => {
  const toast = useToastController();
  return (
    <XStack space="$2" justifyContent="center">
      <Button
        onPress={() => {
          toast.show('Successfully saved!', {
            message: "Don't worry, we've got your data.",
          });
        }}
      >
        Show
      </Button>
      <Button
        onPress={() => {
          toast.hide();
        }}
      >
        Hide
      </Button>
    </XStack>
  );
};

const ToastGallery = () => (
  <Layout
    description=""
    suggestions={['']}
    boundaryConditions={['']}
    elements={[
      {
        title: 'open Modal by renderTrigger',
        element: <ToastControl />,
      },
    ]}
  />
);

export default ToastGallery;
