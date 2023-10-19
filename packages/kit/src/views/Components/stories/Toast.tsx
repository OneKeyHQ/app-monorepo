import { useTheme } from 'tamagui';

import { Button, Toast, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const ToastGallery = () => {
  const theme = useTheme();
  console.log(theme);

  return (
    <Layout
      description=""
      suggestions={['']}
      boundaryConditions={['']}
      elements={[
        {
          title: 'Native',
          element: (
            <YStack space="$2" justifyContent="center">
              <Button
                onPress={() => {
                  Toast.success({
                    title: 'Account created',
                  });
                }}
              >
                <Button.Text>Success</Button.Text>
              </Button>
              <Button
                onPress={() => {
                  Toast.error({
                    title: 'Create account failed',
                  });
                }}
              >
                <Button.Text>Error</Button.Text>
              </Button>
              <Button
                onPress={() => {
                  Toast.message({
                    title: 'Address copied',
                  });
                }}
              >
                <Button.Text>Default</Button.Text>
              </Button>
            </YStack>
          ),
        },
      ]}
    />
  );
};

export default ToastGallery;
