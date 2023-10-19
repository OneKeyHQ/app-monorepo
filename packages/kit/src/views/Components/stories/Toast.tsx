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
                Success
              </Button>
              <Button
                onPress={() => {
                  Toast.error({
                    title: 'Create account failed',
                  });
                }}
              >
                Error
              </Button>
              <Button
                onPress={() => {
                  Toast.message({
                    title: 'Address copied',
                  });
                }}
              >
                Default
              </Button>
            </YStack>
          ),
        },
      ]}
    />
  );
};

export default ToastGallery;
