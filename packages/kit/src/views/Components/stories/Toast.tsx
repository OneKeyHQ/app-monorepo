import * as Burnt from 'burnt';
import { getTokens, useTheme } from 'tamagui';

import { Button, Icon, YStack } from '@onekeyhq/components';

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
                  Burnt.toast({
                    title: 'Account created',
                    preset: 'custom', // default
                    haptic: 'success',
                    icon: {
                      ios: {
                        name: 'checkmark.circle.fill',
                        color: getTokens().color.iconSuccessLight.val,
                      },
                      web: (
                        <Icon
                          name="CheckRadioSolid"
                          color="$iconSuccess"
                          size="$5"
                        />
                      ),
                    },
                  });
                }}
              >
                <Button.Text>Success</Button.Text>
              </Button>
              <Button
                onPress={() => {
                  Burnt.toast({
                    title: 'Create account failed',
                    preset: 'custom',
                    haptic: 'error',
                    icon: {
                      ios: {
                        name: 'x.circle.fill',
                        color: getTokens().color.iconCriticalLight.val,
                      },
                      web: (
                        <Icon
                          name="XCircleSolid"
                          color="$iconCritical"
                          size="$5"
                        />
                      ),
                    },
                  });
                }}
              >
                <Button.Text>Error</Button.Text>
              </Button>
              <Button
                onPress={() => {
                  Burnt.toast({
                    title: 'Address copied',
                    preset: 'none',
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
