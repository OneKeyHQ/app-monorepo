import { useTheme } from 'tamagui';

import { NewButton, Toast, YStack } from '@onekeyhq/components';

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
              <NewButton
                onPress={() => {
                  Toast.success({
                    title: 'Account created',
                  });
                }}
              >
                Success
              </NewButton>
              <NewButton
                onPress={() => {
                  Toast.error({
                    title: 'Create account failed',
                  });
                }}
              >
                Error
              </NewButton>
              <NewButton
                onPress={() => {
                  Toast.message({
                    title: 'Address copied',
                  });
                }}
              >
                Default
              </NewButton>
            </YStack>
          ),
        },
      ]}
    />
  );
};

export default ToastGallery;
