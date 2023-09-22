import { Button } from 'tamagui';

import { ToastController, XStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const ToastControl = () => (
  <XStack space="$2" justifyContent="center">
    <Button
      onPress={() => {
        ToastController.show('success', {
          title: 'Successfully saved!',
          options: {
            message: "Don't worry, we've got your data.",
          },
        });
      }}
    >
      Show
    </Button>
  </XStack>
);

const ToastGallery = () => (
  <Layout
    description=""
    suggestions={['']}
    boundaryConditions={['']}
    elements={[
      {
        title: 'Toast Message',
        element: <ToastControl />,
      },
    ]}
  />
);

export default ToastGallery;
